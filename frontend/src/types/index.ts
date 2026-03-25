export interface PodInfo {
  cluster: string;
  namespace: string;
  name: string;
  ready: string;
  status: string;
  age: string;
}

export interface ServiceInfo {
  cluster: string;
  namespace: string;
  name: string;
  type: string;
  clusterIp: string;
  ports: string;
  age: string;
  pods: PodInfo[];
}

export interface DeploymentInfo {
  cluster: string;
  namespace: string;
  name: string;
  replicas: number;
  available: number;
  age: string;
}

export interface NodeInfo {
  cluster: string;
  name: string;
  status: string;
  roles: string;
  version: string;
  os: string;
  arch: string;
  cpuCapacity: string;
  memoryCapacity: string;
  cpuAllocatable: string;
  memoryAllocatable: string;
  age: string;
}

export interface EventInfo {
  cluster: string;
  namespace: string;
  type: string;
  reason: string;
  object: string;
  message: string;
  count: number;
  lastSeen: string;
}

export interface IngressInfo {
  cluster: string;
  namespace: string;
  name: string;
  hosts: string[];
  paths: string;
  age: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClusterSummary {
  name: string;
  status: string;
  pods: number;
  podsRunning: number;
  podsPending: number;
  podsFailed: number;
  deployments: number;
  deploymentsAvailable: number;
  deploymentsUnavailable: number;
  services: number;
  nodes: number;
  nodesReady: number;
  ingresses: number;
  namespaces: number;
}

export interface SummaryResponse {
  clusters: ClusterSummary[];
}

export type HealthStatus =
  | 'Healthy'
  | 'Progressing'
  | 'Degraded'
  | 'Suspended'
  | 'Missing'
  | 'Unknown';

export type SyncStatus = 'Synced' | 'OutOfSync' | 'Unknown';

export interface AppResource {
  kind: string;
  name: string;
  namespace: string;
  status: string;
  health: HealthStatus;
}

export interface TargetState {
  replicas: number;
}

export interface LiveState {
  availableReplicas: number;
  readyReplicas: number;
  unavailableReplicas: number;
  updatedReplicas: number;
  totalPods: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
}

export interface ApplicationInfo {
  name: string;
  namespace: string;
  cluster: string;
  health: HealthStatus;
  syncStatus: SyncStatus;
  source: string;
  targetState: TargetState;
  liveState: LiveState;
  resources: AppResource[];
  age: string;
}

// Detail types

export type ResourceKind =
  | 'pod'
  | 'service'
  | 'deployment'
  | 'ingress'
  | 'node';

export interface ResourceRef {
  kind: ResourceKind;
  cluster: string;
  namespace: string;
  name: string;
}

export interface ContainerPort {
  name: string;
  containerPort: number;
  protocol: string;
}

export interface ContainerResource {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
}

export interface ContainerDetail {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
  ports: ContainerPort[];
  resources: ContainerResource;
}

export interface PodDetail {
  cluster: string;
  namespace: string;
  name: string;
  ready: string;
  status: string;
  age: string;
  nodeName: string;
  podIP: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  containers: ContainerDetail[];
  events: EventInfo[];
}

export interface ServiceDetail {
  cluster: string;
  namespace: string;
  name: string;
  type: string;
  clusterIp: string;
  ports: string;
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  pods: PodInfo[];
  sessionAffinity: string;
}

export interface DeploymentDetail {
  cluster: string;
  namespace: string;
  name: string;
  replicas: number;
  available: number;
  ready: number;
  updated: number;
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  strategy: string;
  pods: PodInfo[];
  events: EventInfo[];
}

export interface IngressPath {
  path: string;
  pathType: string;
  serviceName: string;
  servicePort: string;
}

export interface IngressRule {
  host: string;
  paths: IngressPath[];
}

export interface IngressDetail {
  cluster: string;
  namespace: string;
  name: string;
  ingressClass: string;
  hosts: string[];
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  rules: IngressRule[];
}

export interface NodeDetail {
  cluster: string;
  name: string;
  status: string;
  roles: string;
  version: string;
  os: string;
  arch: string;
  cpuCapacity: string;
  memoryCapacity: string;
  cpuAllocatable: string;
  memoryAllocatable: string;
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  kernelVersion: string;
  containerRuntime: string;
  internalIP: string;
  podCIDR: string;
  pods: PodInfo[];
}
