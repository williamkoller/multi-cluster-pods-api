package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/williamkoller/multi-cluster-pods-api/internal/kubernetes"
)

type Handler struct {
	manager *kubernetes.MultiClusterManager
}

func NewHandler(manager *kubernetes.MultiClusterManager) *Handler {
	return &Handler{manager: manager}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

func (h *Handler) ListClusters(c *gin.Context) {
	clusters := h.manager.ListClusters()
	c.JSON(http.StatusOK, gin.H{
		"clusters": clusters,
	})
}

func (h *Handler) ListPodsAllClusters(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	pods, err := h.manager.ListPodsFromAllClusters(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, pods)
}

func (h *Handler) ListPodsByCluster(c *gin.Context) {
	cluster := c.Param("cluster")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	pods, err := h.manager.ListPodsFromCluster(ctx, cluster)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, pods)
}
