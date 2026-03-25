#!/bin/sh
set -e

# Rewrite kubeconfig so the container can reach Kind's API servers
# via the control-plane containers on the shared "kind" Docker network.
# For a kind cluster named "kind-X", the control-plane container is "X-control-plane".
mkdir -p /app/.kube
cp /tmp/.kube/config /app/.kube/config

# Replace certificate-authority-data with insecure-skip-tls-verify
sed -i 's/certificate-authority-data:.*/insecure-skip-tls-verify: true/' /app/.kube/config

# Build a mapping of server URLs to control-plane hostnames by parsing
# cluster entries. In kubeconfig, "server:" comes before "name:" within
# each cluster block, so we first collect the pairs, then apply replacements.
# Extract pairs: "original_server_url cluster-name"
pairs=$(awk '
  /^- cluster:/ { server="" }
  /server:/ { gsub(/^[ \t]*server:[ \t]*/, ""); server=$0 }
  /^  name: kind-/ { name=$0; gsub(/^  name: kind-/, "", name); if (server != "") { print server, name; server="" } }
' /app/.kube/config)

# For each pair, replace the original server URL with the control-plane hostname
echo "$pairs" | while IFS=' ' read -r original_url cluster_name; do
  if [ -n "$original_url" ] && [ -n "$cluster_name" ]; then
    # Escape dots and slashes for sed
    escaped_url=$(echo "$original_url" | sed 's/[.\/&]/\\&/g')
    sed -i "s|${original_url}|https://${cluster_name}-control-plane:6443|g" /app/.kube/config
  fi
done

chown 65534:65534 /app/.kube/config

exec su-exec 65534:65534 /server
