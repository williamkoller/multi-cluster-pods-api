package kubernetes

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/williamkoller/multi-cluster-pods-api/internal/model"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
)

func (m *MultiClusterManager) GetPodDetail(ctx context.Context, cluster, namespace, name string) (*model.PodDetail, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod %s/%s: %w", namespace, name, err)
	}

	containers := make([]model.ContainerDetail, 0, len(pod.Spec.Containers))
	statusMap := make(map[string]v1.ContainerStatus)
	for _, cs := range pod.Status.ContainerStatuses {
		statusMap[cs.Name] = cs
	}

	for _, c := range pod.Spec.Containers {
		cs := statusMap[c.Name]
		state := "Waiting"
		if cs.State.Running != nil {
			state = "Running"
		} else if cs.State.Terminated != nil {
			state = "Terminated"
		}

		ports := make([]model.ContainerPort, 0, len(c.Ports))
		for _, p := range c.Ports {
			ports = append(ports, model.ContainerPort{
				Name:          p.Name,
				ContainerPort: p.ContainerPort,
				Protocol:      string(p.Protocol),
			})
		}

		containers = append(containers, model.ContainerDetail{
			Name:         c.Name,
			Image:        c.Image,
			Ready:        cs.Ready,
			RestartCount: cs.RestartCount,
			State:        state,
			Ports:        ports,
			Resources: model.ContainerResource{
				CPURequest:    c.Resources.Requests.Cpu().String(),
				CPULimit:      c.Resources.Limits.Cpu().String(),
				MemoryRequest: c.Resources.Requests.Memory().String(),
				MemoryLimit:   c.Resources.Limits.Memory().String(),
			},
		})
	}

	eventList, _ := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("involvedObject.name", name).String(),
	})
	events := make([]model.EventInfo, 0)
	if eventList != nil {
		for _, e := range eventList.Items {
			lastSeen := translateTimestampSince(e.LastTimestamp.Time)
			if e.LastTimestamp.IsZero() {
				lastSeen = translateTimestampSince(e.CreationTimestamp.Time)
			}
			events = append(events, model.EventInfo{
				Cluster:   cluster,
				Namespace: e.Namespace,
				Type:      e.Type,
				Reason:    e.Reason,
				Object:    fmt.Sprintf("%s/%s", strings.ToLower(e.InvolvedObject.Kind), e.InvolvedObject.Name),
				Message:   e.Message,
				Count:     e.Count,
				LastSeen:  lastSeen,
			})
		}
	}

	return &model.PodDetail{
		Cluster:     cluster,
		Namespace:   pod.Namespace,
		Name:        pod.Name,
		Ready:       formatReady(*pod),
		Status:      string(pod.Status.Phase),
		Age:         translateTimestampSince(pod.CreationTimestamp.Time),
		NodeName:    pod.Spec.NodeName,
		PodIP:       pod.Status.PodIP,
		Labels:      pod.Labels,
		Annotations: pod.Annotations,
		Containers:  containers,
		Events:      events,
	}, nil
}

func (m *MultiClusterManager) GetServiceDetail(ctx context.Context, cluster, namespace, name string) (*model.ServiceDetail, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	svc, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get service %s/%s: %w", namespace, name, err)
	}

	var pods []model.PodInfo
	if len(svc.Spec.Selector) > 0 {
		selector := labels.Set(svc.Spec.Selector).String()
		podList, err := client.CoreV1().Pods(svc.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: selector,
		})
		if err == nil {
			for _, pod := range podList.Items {
				pods = append(pods, model.PodInfo{
					Cluster:   cluster,
					Namespace: pod.Namespace,
					Name:      pod.Name,
					Ready:     formatReady(pod),
					Status:    string(pod.Status.Phase),
					Age:       translateTimestampSince(pod.CreationTimestamp.Time),
				})
			}
		}
	}
	if pods == nil {
		pods = []model.PodInfo{}
	}

	return &model.ServiceDetail{
		Cluster:         cluster,
		Namespace:       svc.Namespace,
		Name:            svc.Name,
		Type:            string(svc.Spec.Type),
		ClusterIP:       svc.Spec.ClusterIP,
		Ports:           formatServicePorts(*svc),
		Age:             translateTimestampSince(svc.CreationTimestamp.Time),
		Labels:          svc.Labels,
		Annotations:     svc.Annotations,
		Selector:        svc.Spec.Selector,
		Pods:            pods,
		SessionAffinity: string(svc.Spec.SessionAffinity),
	}, nil
}

func (m *MultiClusterManager) GetDeploymentDetail(ctx context.Context, cluster, namespace, name string) (*model.DeploymentDetail, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	deploy, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment %s/%s: %w", namespace, name, err)
	}

	var replicas int32
	if deploy.Spec.Replicas != nil {
		replicas = *deploy.Spec.Replicas
	}

	var pods []model.PodInfo
	if deploy.Spec.Selector != nil && len(deploy.Spec.Selector.MatchLabels) > 0 {
		selector := labels.Set(deploy.Spec.Selector.MatchLabels).String()
		podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: selector,
		})
		if err == nil {
			for _, pod := range podList.Items {
				pods = append(pods, model.PodInfo{
					Cluster:   cluster,
					Namespace: pod.Namespace,
					Name:      pod.Name,
					Ready:     formatReady(pod),
					Status:    string(pod.Status.Phase),
					Age:       translateTimestampSince(pod.CreationTimestamp.Time),
				})
			}
		}
	}
	if pods == nil {
		pods = []model.PodInfo{}
	}

	eventList, _ := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("involvedObject.name", name).String(),
	})
	events := make([]model.EventInfo, 0)
	if eventList != nil {
		for _, e := range eventList.Items {
			lastSeen := translateTimestampSince(e.LastTimestamp.Time)
			if e.LastTimestamp.IsZero() {
				lastSeen = translateTimestampSince(e.CreationTimestamp.Time)
			}
			events = append(events, model.EventInfo{
				Cluster:   cluster,
				Namespace: e.Namespace,
				Type:      e.Type,
				Reason:    e.Reason,
				Object:    fmt.Sprintf("%s/%s", strings.ToLower(e.InvolvedObject.Kind), e.InvolvedObject.Name),
				Message:   e.Message,
				Count:     e.Count,
				LastSeen:  lastSeen,
			})
		}
	}

	return &model.DeploymentDetail{
		Cluster:     cluster,
		Namespace:   deploy.Namespace,
		Name:        deploy.Name,
		Replicas:    replicas,
		Available:   deploy.Status.AvailableReplicas,
		Ready:       deploy.Status.ReadyReplicas,
		Updated:     deploy.Status.UpdatedReplicas,
		Age:         translateTimestampSince(deploy.CreationTimestamp.Time),
		Labels:      deploy.Labels,
		Annotations: deploy.Annotations,
		Selector:    deploy.Spec.Selector.MatchLabels,
		Strategy:    string(deploy.Spec.Strategy.Type),
		Pods:        pods,
		Events:      events,
	}, nil
}

func (m *MultiClusterManager) GetIngressDetail(ctx context.Context, cluster, namespace, name string) (*model.IngressDetail, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	ing, err := client.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get ingress %s/%s: %w", namespace, name, err)
	}

	hosts := []string{}
	rules := make([]model.IngressRule, 0, len(ing.Spec.Rules))
	for _, rule := range ing.Spec.Rules {
		if rule.Host != "" {
			hosts = append(hosts, rule.Host)
		}
		paths := make([]model.IngressPath, 0)
		if rule.HTTP != nil {
			for _, p := range rule.HTTP.Paths {
				pathType := ""
				if p.PathType != nil {
					pathType = string(*p.PathType)
				}
				svcPort := ""
				if p.Backend.Service != nil {
					if p.Backend.Service.Port.Number != 0 {
						svcPort = strconv.Itoa(int(p.Backend.Service.Port.Number))
					} else {
						svcPort = p.Backend.Service.Port.Name
					}
				}
				svcName := ""
				if p.Backend.Service != nil {
					svcName = p.Backend.Service.Name
				}
				paths = append(paths, model.IngressPath{
					Path:        p.Path,
					PathType:    pathType,
					ServiceName: svcName,
					ServicePort: svcPort,
				})
			}
		}
		rules = append(rules, model.IngressRule{
			Host:  rule.Host,
			Paths: paths,
		})
	}

	ingressClass := ""
	if ing.Spec.IngressClassName != nil {
		ingressClass = *ing.Spec.IngressClassName
	}

	return &model.IngressDetail{
		Cluster:      cluster,
		Namespace:    ing.Namespace,
		Name:         ing.Name,
		IngressClass: ingressClass,
		Hosts:        hosts,
		Age:          translateTimestampSince(ing.CreationTimestamp.Time),
		Labels:       ing.Labels,
		Annotations:  ing.Annotations,
		Rules:        rules,
	}, nil
}

func (m *MultiClusterManager) GetNodeDetail(ctx context.Context, cluster, nodeName string) (*model.NodeDetail, error) {
	client, ok := m.clients[cluster]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", cluster)
	}

	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get node %s: %w", nodeName, err)
	}

	status := "NotReady"
	for _, cond := range node.Status.Conditions {
		if cond.Type == v1.NodeReady && cond.Status == v1.ConditionTrue {
			status = "Ready"
			break
		}
	}

	roles := []string{}
	for label := range node.Labels {
		if strings.HasPrefix(label, "node-role.kubernetes.io/") {
			roles = append(roles, strings.TrimPrefix(label, "node-role.kubernetes.io/"))
		}
	}
	if len(roles) == 0 {
		roles = append(roles, "<none>")
	}
	sort.Strings(roles)

	internalIP := ""
	for _, addr := range node.Status.Addresses {
		if addr.Type == v1.NodeInternalIP {
			internalIP = addr.Address
			break
		}
	}

	podList, _ := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: fields.OneTermEqualSelector("spec.nodeName", nodeName).String(),
	})
	var pods []model.PodInfo
	if podList != nil {
		for _, pod := range podList.Items {
			pods = append(pods, model.PodInfo{
				Cluster:   cluster,
				Namespace: pod.Namespace,
				Name:      pod.Name,
				Ready:     formatReady(pod),
				Status:    string(pod.Status.Phase),
				Age:       translateTimestampSince(pod.CreationTimestamp.Time),
			})
		}
	}
	if pods == nil {
		pods = []model.PodInfo{}
	}

	return &model.NodeDetail{
		Cluster:           cluster,
		Name:              node.Name,
		Status:            status,
		Roles:             strings.Join(roles, ","),
		Version:           node.Status.NodeInfo.KubeletVersion,
		OS:                node.Status.NodeInfo.OperatingSystem,
		Arch:              node.Status.NodeInfo.Architecture,
		CPUCapacity:       node.Status.Capacity.Cpu().String(),
		MemoryCapacity:    node.Status.Capacity.Memory().String(),
		CPUAllocatable:    node.Status.Allocatable.Cpu().String(),
		MemoryAllocatable: node.Status.Allocatable.Memory().String(),
		Age:               translateTimestampSince(node.CreationTimestamp.Time),
		Labels:            node.Labels,
		Annotations:       node.Annotations,
		KernelVersion:     node.Status.NodeInfo.KernelVersion,
		ContainerRuntime:  node.Status.NodeInfo.ContainerRuntimeVersion,
		InternalIP:        internalIP,
		PodCIDR:           node.Spec.PodCIDR,
		Pods:              pods,
	}, nil
}
