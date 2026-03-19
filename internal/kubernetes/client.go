package kubernetes

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/williamkoller/multi-cluster-pods-api/internal/model"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type MultiClusterManager struct {
	clients map[string]*kubernetes.Clientset
}

func NewMultiClusterManager(kubeconfigPath string) (*MultiClusterManager, error) {
	config, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	clients := make(map[string]*kubernetes.Clientset)

	for contextName := range config.Contexts {
		restConfig, err := buildConfigFromContext(kubeconfigPath, contextName)
		if err != nil {
			return nil, fmt.Errorf("failed to build rest config for context %s: %w", contextName, err)
		}

		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create clientset for context %s: %w", contextName, err)
		}

		clients[contextName] = clientset
	}

	return &MultiClusterManager{
		clients: clients,
	}, nil
}

func buildConfigFromContext(kubeconfigPath, contextName string) (*rest.Config, error) {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath}
	overrides := &clientcmd.ConfigOverrides{
		CurrentContext: contextName,
	}
	clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, overrides)
	return clientConfig.ClientConfig()
}

func (m *MultiClusterManager) ListClusters() []string {
	clusters := make([]string, 0, len(m.clients))
	for name := range m.clients {
		clusters = append(clusters, name)
	}
	sort.Strings(clusters)
	return clusters
}

func (m *MultiClusterManager) ListPodsFromCluster(ctx context.Context, cluster string) ([]model.PodInfo, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	podList, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods in cluster %s: %w", cluster, err)
	}

	result := make([]model.PodInfo, 0, len(podList.Items))
	for _, pod := range podList.Items {
		result = append(result, model.PodInfo{
			Cluster:   cluster,
			Namespace: pod.Namespace,
			Name:      pod.Name,
			Ready:     formatReady(pod),
			Status:    string(pod.Status.Phase),
			Age:       translateTimestampSince(pod.CreationTimestamp.Time),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Namespace == result[j].Namespace {
			return result[i].Name < result[j].Name
		}
		return result[i].Namespace < result[j].Namespace
	})

	return result, nil
}

func (m *MultiClusterManager) ListPodsFromAllClusters(ctx context.Context) ([]model.PodInfo, error) {
	clusters := m.ListClusters()
	all := make([]model.PodInfo, 0)

	for _, cluster := range clusters {
		pods, err := m.ListPodsFromCluster(ctx, cluster)
		if err != nil {
			return nil, err
		}
		all = append(all, pods...)
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].Cluster == all[j].Cluster {
			if all[i].Namespace == all[j].Namespace {
				return all[i].Name < all[j].Name
			}
			return all[i].Namespace < all[j].Namespace
		}
		return all[i].Cluster < all[j].Cluster
	})

	return all, nil
}

func formatReady(pod v1.Pod) string {
	total := len(pod.Status.ContainerStatuses)
	ready := 0

	for _, c := range pod.Status.ContainerStatuses {
		if c.Ready {
			ready++
		}
	}

	return fmt.Sprintf("%d/%d", ready, total)
}

func translateTimestampSince(t time.Time) string {
	diff := time.Since(t)

	switch {
	case diff < time.Minute:
		return fmt.Sprintf("%ds", int(diff.Seconds()))
	case diff < time.Hour:
		return fmt.Sprintf("%dm", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("%dh", int(diff.Hours()))
	default:
		return fmt.Sprintf("%dd", int(diff.Hours()/24))
	}
}
