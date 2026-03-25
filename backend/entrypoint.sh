#!/bin/sh
set -e

# Rewrite kubeconfig so the container can reach Kind's API server
# via the control-plane container on the shared "kind" Docker network.
mkdir -p /app/.kube
sed \
  -e 's|https://127\.0\.0\.1:[0-9]*|https://kind-control-plane:6443|g' \
  -e 's|https://localhost:[0-9]*|https://kind-control-plane:6443|g' \
  -e 's/certificate-authority-data:.*/insecure-skip-tls-verify: true/' \
  /tmp/.kube/config > /app/.kube/config

chown 65534:65534 /app/.kube/config

exec su-exec 65534:65534 /server
