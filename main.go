package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/williamkoller/multi-cluster-pods-api/internal/api"
	"github.com/williamkoller/multi-cluster-pods-api/internal/kubernetes"
)

func main() {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("failed to get user home dir: %v", err)
		}
		kubeconfig = home + "/.kube/config"
	}

	manager, err := kubernetes.NewMultiClusterManager(kubeconfig)
	if err != nil {
		log.Fatalf("failed to initialize multi-cluster manager: %v", err)
	}

	handler := api.NewHandler(manager)

	router := gin.Default()

	router.GET("/health", handler.Health)
	router.GET("/clusters", handler.ListClusters)
	router.GET("/pods", handler.ListPodsAllClusters)
	router.GET("/pods/:cluster", handler.ListPodsByCluster)

	addr := ":8080"
	log.Printf("server running on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
