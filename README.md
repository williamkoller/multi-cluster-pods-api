# Multi-Cluster

Dashboard para gerenciamento e observabilidade de múltiplos clusters Kubernetes. Agrega workloads de todos os contextos do kubeconfig em uma interface única, oferecendo visualização em tempo real e ações operacionais como scale, restart e streaming de logs.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)

## Funcionalidades

### Visão Geral (Overview)

- Dashboard com métricas agregadas por cluster (pods, deployments, services, nodes, namespaces, ingresses)
- Cards de saúde por cluster com indicadores visuais (ring gauges)

### Aplicações (Applications)

- Visão estilo ArgoCD derivada dos Deployments
- Status de saúde (Healthy, Progressing, Degraded, Suspended)
- Status de sincronização (Synced, OutOfSync)
- Árvore de recursos expandível (Deployment → Pods → Services)

### Pods

- Listagem paginada com filtro por cluster e namespace
- Restart (delete + recriação pelo controller)
- Visualização de logs com tail configurável
- Streaming de logs em tempo real via SSE

### Deployments

- Listagem com réplicas desejadas vs disponíveis
- Scale (0–100 réplicas)
- Rollout restart

### Services

- Listagem com tipo, ClusterIP e portas
- Expansão para ver pods associados via label selector

### Nodes

- Status, roles, versão, OS, arquitetura
- Capacidade e alocação de CPU/memória

### Events & Ingresses

- Eventos do cluster com severidade e contagem
- Ingresses com hosts e paths

### Interface

- Seletor de cluster (individual ou todos)
- Filtro por namespace
- Busca client-side na página atual
- Auto-refresh configurável (5s, 10s, 30s, 60s)
- Exportação CSV
- Dark mode persistido em localStorage
- Notificações toast

## Arquitetura

```
┌─────────────┐       ┌─────────────┐       ┌───────────────────┐
│   Frontend   │──────▶│   Backend   │──────▶│  Kubernetes API   │
│  React/Vite  │  /api │   Go/Gin    │       │ (multi-cluster)   │
│  nginx:8080  │◀──────│   :8080     │◀──────│                   │
└─────────────┘       └──────┬──────┘       └───────────────────┘
                             │
                      ┌──────▼──────┐
                      │    Redis    │
                      │  (cache L1) │
                      │  + in-mem   │
                      │  (cache L2) │
                      └─────────────┘
```

- **Cache em dois níveis**: Redis (L1) + in-memory (L2) com TTL de 30s
- **Background worker**: warm-up do cache a cada 10s para todos os recursos
- **Degradação graciosa**: se o Redis não estiver disponível, o cache in-memory continua funcionando
- **Concorrência**: fan-out com goroutines para queries em múltiplos clusters simultaneamente

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/)
- Clusters Kubernetes acessíveis via kubeconfig (ex: [kind](https://kind.sigs.k8s.io/))
- Rede Docker `kind` criada (para comunicação com clusters kind)

```bash
docker network create kind 2>/dev/null || true
```

## Início Rápido

### 1. Clone o repositório

```bash
git clone https://github.com/williamkoller/multi-cluster-pods-api.git
cd multi-cluster-pods-api
```

### 2. Configure as variáveis de ambiente (opcional)

Crie um arquivo `.env` na raiz do projeto:

```env
KUBECONFIG=~/.kube/config
REDIS_PORT=6379
BACKEND_PORT=8080
FRONTEND_PORT=3000
GIN_MODE=release
```

### 3. Suba a aplicação

```bash
docker compose up --build -d
```

### 4. Acesse o dashboard

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Desenvolvimento Local

### Backend

```bash
cd backend
go run main.go
```

O servidor inicia na porta `8080`. Variáveis de ambiente:

| Variável     | Descrição                       | Padrão           |
| ------------ | ------------------------------- | ---------------- |
| `KUBECONFIG` | Caminho para o kubeconfig       | `~/.kube/config` |
| `REDIS_ADDR` | Endereço do Redis (host:porta)  | _(desabilitado)_ |
| `GIN_MODE`   | Modo do Gin (`debug`/`release`) | `debug`          |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O Vite inicia em [http://localhost:5173](http://localhost:5173) com proxy automático de `/api` para `http://localhost:8080`.

## API Endpoints

| Método   | Endpoint                                                   | Descrição                            |
| -------- | ---------------------------------------------------------- | ------------------------------------ |
| `GET`    | `/api/health`                                              | Health check                         |
| `GET`    | `/api/clusters`                                            | Listar clusters                      |
| `GET`    | `/api/summary`                                             | Resumo agregado de todos os clusters |
| `GET`    | `/api/pods`                                                | Listar pods (todos os clusters)      |
| `GET`    | `/api/pods/:cluster`                                       | Listar pods de um cluster            |
| `DELETE` | `/api/pods/:cluster/:namespace/:pod`                       | Restart de pod                       |
| `GET`    | `/api/pods/:cluster/:namespace/:pod/logs`                  | Logs do pod                          |
| `GET`    | `/api/pods/:cluster/:namespace/:pod/logs/stream`           | Streaming de logs (SSE)              |
| `GET`    | `/api/services`                                            | Listar services                      |
| `GET`    | `/api/services/:cluster`                                   | Listar services de um cluster        |
| `GET`    | `/api/deployments`                                         | Listar deployments                   |
| `GET`    | `/api/deployments/:cluster`                                | Listar deployments de um cluster     |
| `PUT`    | `/api/deployments/:cluster/:namespace/:deployment/scale`   | Scale de deployment                  |
| `POST`   | `/api/deployments/:cluster/:namespace/:deployment/restart` | Rollout restart                      |
| `GET`    | `/api/namespaces`                                          | Listar namespaces por cluster        |
| `GET`    | `/api/nodes`                                               | Listar nodes                         |
| `GET`    | `/api/nodes/:cluster`                                      | Listar nodes de um cluster           |
| `GET`    | `/api/events`                                              | Listar events                        |
| `GET`    | `/api/events/:cluster`                                     | Listar events de um cluster          |
| `GET`    | `/api/ingresses`                                           | Listar ingresses                     |
| `GET`    | `/api/ingresses/:cluster`                                  | Listar ingresses de um cluster       |
| `GET`    | `/api/applications`                                        | Listar applications                  |
| `GET`    | `/api/applications/:cluster`                               | Listar applications de um cluster    |

**Query params comuns**: `namespace`, `page` (padrão: 1), `pageSize` (padrão: 50, máximo: 500)

## Demo com Kind

Arquivos de demonstração estão disponíveis em `backend/deploy/`:

```bash
# Criar clusters kind
kind create cluster --name cluster-a
kind create cluster --name cluster-b

# Aplicar demo workloads
kubectl --context kind-cluster-a apply -f backend/deploy/cluster-a-demo.yml
kubectl --context kind-cluster-b apply -f backend/deploy/cluster-b-demo.yml
```

## Estrutura do Projeto

```
├── docker-compose.yml            # Orquestração dos serviços
├── backend/
│   ├── Dockerfile                # Build multi-stage Go
│   ├── entrypoint.sh             # Configuração do kubeconfig no container
│   ├── main.go                   # Ponto de entrada, rotas e inicialização
│   ├── go.mod
│   ├── deploy/                   # Manifests de demonstração
│   └── internal/
│       ├── api/handler.go        # Handlers HTTP (Gin)
│       ├── cache/
│       │   ├── cache.go          # Cache Redis + in-memory
│       │   └── worker.go         # Background warm-up worker
│       ├── kubernetes/client.go  # Multi-cluster Kubernetes manager
│       ├── middleware/cors.go    # CORS middleware
│       └── model/pod.go         # DTOs e paginação
├── frontend/
│   ├── Dockerfile                # Build multi-stage Node + nginx
│   ├── nginx.conf                # Proxy reverso + SPA routing
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx               # Layout principal com tabs
│       ├── api/client.ts         # Cliente HTTP para o backend
│       ├── types/index.ts        # Tipos TypeScript
│       ├── hooks/useToast.ts     # Hook de notificações
│       └── components/           # Componentes React
│           ├── ApplicationCard   # Cards de aplicação estilo ArgoCD
│           ├── OverviewCards     # Cards de resumo por cluster
│           ├── PodsTable         # Tabela de pods com ações
│           ├── PodLogsViewer     # Visualizador de logs com SSE
│           ├── DeploymentsTable  # Tabela de deployments com scale/restart
│           ├── ServicesTable     # Tabela de services expandível
│           ├── NodesTable        # Tabela de nodes
│           ├── EventsTable       # Tabela de eventos
│           ├── IngressesTable    # Tabela de ingresses
│           └── ...               # Pagination, SearchBar, StatusBadge, etc.
```

## Stack Tecnológica

| Camada   | Tecnologia                                           |
| -------- | ---------------------------------------------------- |
| Backend  | Go, Gin, client-go, go-redis                         |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI |
| Cache    | Redis 7 (L1) + in-memory (L2)                        |
| Infra    | Docker Compose, nginx                                |

## Licença

Este projeto está sob a licença MIT.
