import { useEffect, useState } from 'react';
import {
  getPodDetail,
  getServiceDetail,
  getDeploymentDetail,
  getIngressDetail,
  getNodeDetail,
} from '../api/client';
import { StatusBadge } from './StatusBadge';
import type {
  ResourceRef,
  PodDetail,
  ServiceDetail,
  DeploymentDetail,
  IngressDetail,
  NodeDetail,
} from '../types';

type DetailData =
  | ({ _kind: 'pod' } & PodDetail)
  | ({ _kind: 'service' } & ServiceDetail)
  | ({ _kind: 'deployment' } & DeploymentDetail)
  | ({ _kind: 'ingress' } & IngressDetail)
  | ({ _kind: 'node' } & NodeDetail);

interface ResourceDetailProps {
  resource: ResourceRef;
  onClose: () => void;
  onNavigate: (ref: ResourceRef) => void;
}

function NameLink({
  kind,
  cluster,
  namespace,
  name,
  onNavigate,
}: ResourceRef & { onNavigate: (ref: ResourceRef) => void }) {
  return (
    <button
      onClick={() => onNavigate({ kind, cluster, namespace, name })}
      className='text-[var(--color-accent)] hover:underline font-mono text-xs'
    >
      {name}
    </button>
  );
}

function LabelBadges({ labels }: { labels: Record<string, string> | null }) {
  if (!labels || Object.keys(labels).length === 0)
    return <span className='text-[var(--color-text-muted)] text-xs'>—</span>;
  return (
    <div className='flex flex-wrap gap-1'>
      {Object.entries(labels).map(([k, v]) => (
        <span
          key={k}
          className='inline-flex rounded bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]'
        >
          {k}={v}
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='mt-4'>
      <h4 className='text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2'>
        {title}
      </h4>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex gap-2 py-1'>
      <span className='text-xs font-medium text-[var(--color-text-muted)] w-36 shrink-0'>
        {label}
      </span>
      <span className='text-xs text-[var(--color-text-primary)] break-all'>
        {value || '—'}
      </span>
    </div>
  );
}

function PodDetailView({
  data,
  onNavigate,
}: {
  data: PodDetail;
  onNavigate: (ref: ResourceRef) => void;
}) {
  return (
    <>
      <Section title='Pod Info'>
        <KV label='Cluster' value={data.cluster} />
        <KV label='Namespace' value={data.namespace} />
        <KV label='Status' value={<StatusBadge status={data.status} />} />
        <KV label='Ready' value={data.ready} />
        <KV label='Age' value={data.age} />
        <KV
          label='Node'
          value={
            data.nodeName ? (
              <NameLink
                kind='node'
                cluster={data.cluster}
                namespace=''
                name={data.nodeName}
                onNavigate={onNavigate}
              />
            ) : (
              '—'
            )
          }
        />
        <KV label='Pod IP' value={data.podIP} />
      </Section>
      <Section title='Labels'>
        <LabelBadges labels={data.labels} />
      </Section>
      <Section title='Containers'>
        {data.containers.map((c) => (
          <div
            key={c.name}
            className='rounded border border-[var(--color-border)] p-3 mb-2 bg-[var(--color-surface)]'
          >
            <div className='flex items-center justify-between mb-1'>
              <span className='font-mono text-xs font-semibold text-[var(--color-text-primary)]'>
                {c.name}
              </span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.ready ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]' : 'bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]'}`}
              >
                {c.state}
              </span>
            </div>
            <KV label='Image' value={c.image} />
            <KV label='Restarts' value={String(c.restartCount)} />
            {c.ports.length > 0 && (
              <KV
                label='Ports'
                value={c.ports
                  .map(
                    (p) =>
                      `${p.containerPort}/${p.protocol}${p.name ? ` (${p.name})` : ''}`,
                  )
                  .join(', ')}
              />
            )}
            <KV
              label='CPU'
              value={`${c.resources.cpuRequest} / ${c.resources.cpuLimit}`}
            />
            <KV
              label='Memory'
              value={`${c.resources.memoryRequest} / ${c.resources.memoryLimit}`}
            />
          </div>
        ))}
      </Section>
      {data.events.length > 0 && (
        <Section title='Events'>
          <EventsMiniTable events={data.events} />
        </Section>
      )}
    </>
  );
}

function ServiceDetailView({
  data,
  onNavigate,
}: {
  data: ServiceDetail;
  onNavigate: (ref: ResourceRef) => void;
}) {
  return (
    <>
      <Section title='Service Info'>
        <KV label='Cluster' value={data.cluster} />
        <KV label='Namespace' value={data.namespace} />
        <KV label='Type' value={data.type} />
        <KV label='Cluster IP' value={data.clusterIp} />
        <KV label='Ports' value={data.ports} />
        <KV label='Session Affinity' value={data.sessionAffinity} />
        <KV label='Age' value={data.age} />
      </Section>
      <Section title='Selector'>
        <LabelBadges labels={data.selector} />
      </Section>
      <Section title='Labels'>
        <LabelBadges labels={data.labels} />
      </Section>
      {data.pods.length > 0 && (
        <Section title={`Pods (${data.pods.length})`}>
          <PodsMiniTable
            pods={data.pods}
            cluster={data.cluster}
            onNavigate={onNavigate}
          />
        </Section>
      )}
    </>
  );
}

function DeploymentDetailView({
  data,
  onNavigate,
}: {
  data: DeploymentDetail;
  onNavigate: (ref: ResourceRef) => void;
}) {
  return (
    <>
      <Section title='Deployment Info'>
        <KV label='Cluster' value={data.cluster} />
        <KV label='Namespace' value={data.namespace} />
        <KV label='Strategy' value={data.strategy} />
        <KV label='Replicas' value={String(data.replicas)} />
        <KV label='Available' value={String(data.available)} />
        <KV label='Ready' value={String(data.ready)} />
        <KV label='Updated' value={String(data.updated)} />
        <KV label='Age' value={data.age} />
      </Section>
      <Section title='Selector'>
        <LabelBadges labels={data.selector} />
      </Section>
      <Section title='Labels'>
        <LabelBadges labels={data.labels} />
      </Section>
      {data.pods.length > 0 && (
        <Section title={`Pods (${data.pods.length})`}>
          <PodsMiniTable
            pods={data.pods}
            cluster={data.cluster}
            onNavigate={onNavigate}
          />
        </Section>
      )}
      {data.events.length > 0 && (
        <Section title='Events'>
          <EventsMiniTable events={data.events} />
        </Section>
      )}
    </>
  );
}

function IngressDetailView({ data }: { data: IngressDetail }) {
  return (
    <>
      <Section title='Ingress Info'>
        <KV label='Cluster' value={data.cluster} />
        <KV label='Namespace' value={data.namespace} />
        <KV label='Ingress Class' value={data.ingressClass} />
        <KV label='Hosts' value={data.hosts.join(', ') || '—'} />
        <KV label='Age' value={data.age} />
      </Section>
      <Section title='Labels'>
        <LabelBadges labels={data.labels} />
      </Section>
      <Section title='Rules'>
        {data.rules.map((rule, i) => (
          <div
            key={i}
            className='rounded border border-[var(--color-border)] p-3 mb-2 bg-[var(--color-surface)]'
          >
            <div className='font-mono text-xs font-semibold text-[var(--color-text-primary)] mb-1'>
              {rule.host || '*'}
            </div>
            {rule.paths.map((p, j) => (
              <div
                key={j}
                className='text-xs text-[var(--color-text-secondary)]'
              >
                <span className='font-mono'>{p.path}</span>
                <span className='text-[var(--color-text-muted)]'> → </span>
                <span className='font-mono'>
                  {p.serviceName}:{p.servicePort}
                </span>
                <span className='text-[var(--color-text-muted)] ml-1'>
                  ({p.pathType})
                </span>
              </div>
            ))}
          </div>
        ))}
      </Section>
    </>
  );
}

function NodeDetailView({
  data,
  onNavigate,
}: {
  data: NodeDetail;
  onNavigate: (ref: ResourceRef) => void;
}) {
  return (
    <>
      <Section title='Node Info'>
        <KV label='Cluster' value={data.cluster} />
        <KV label='Status' value={<StatusBadge status={data.status} />} />
        <KV label='Roles' value={data.roles} />
        <KV label='Version' value={data.version} />
        <KV label='OS / Arch' value={`${data.os}/${data.arch}`} />
        <KV label='Kernel' value={data.kernelVersion} />
        <KV label='Runtime' value={data.containerRuntime} />
        <KV label='Internal IP' value={data.internalIP} />
        <KV label='Pod CIDR' value={data.podCIDR} />
        <KV label='Age' value={data.age} />
      </Section>
      <Section title='Capacity'>
        <KV
          label='CPU'
          value={`${data.cpuAllocatable} allocatable / ${data.cpuCapacity} capacity`}
        />
        <KV
          label='Memory'
          value={`${data.memoryAllocatable} allocatable / ${data.memoryCapacity} capacity`}
        />
      </Section>
      <Section title='Labels'>
        <LabelBadges labels={data.labels} />
      </Section>
      {data.pods.length > 0 && (
        <Section title={`Pods (${data.pods.length})`}>
          <PodsMiniTable
            pods={data.pods}
            cluster={data.cluster}
            onNavigate={onNavigate}
          />
        </Section>
      )}
    </>
  );
}

function PodsMiniTable({
  pods,
  cluster,
  onNavigate,
}: {
  pods: {
    namespace: string;
    name: string;
    ready: string;
    status: string;
    age: string;
  }[];
  cluster: string;
  onNavigate: (ref: ResourceRef) => void;
}) {
  return (
    <div className='rounded border border-[var(--color-border)] overflow-hidden'>
      <table className='w-full divide-y divide-[var(--color-border)]'>
        <thead className='bg-[var(--color-surface-sunken)]'>
          <tr>
            {['Name', 'Namespace', 'Ready', 'Status', 'Age'].map((h) => (
              <th
                key={h}
                className='px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]'
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface)]'>
          {pods.map((pod) => (
            <tr key={`${pod.namespace}-${pod.name}`}>
              <td className='px-2 py-1 text-xs'>
                <NameLink
                  kind='pod'
                  cluster={cluster}
                  namespace={pod.namespace}
                  name={pod.name}
                  onNavigate={onNavigate}
                />
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-secondary)]'>
                {pod.namespace}
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-secondary)]'>
                {pod.ready}
              </td>
              <td className='px-2 py-1 text-xs'>
                <StatusBadge status={pod.status} />
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-muted)]'>
                {pod.age}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsMiniTable({
  events,
}: {
  events: {
    type: string;
    reason: string;
    message: string;
    count: number;
    lastSeen: string;
  }[];
}) {
  return (
    <div className='rounded border border-[var(--color-border)] overflow-hidden'>
      <table className='w-full divide-y divide-[var(--color-border)]'>
        <thead className='bg-[var(--color-surface-sunken)]'>
          <tr>
            {['Type', 'Reason', 'Message', 'Count', 'Last Seen'].map((h) => (
              <th
                key={h}
                className='px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]'
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-[var(--color-border-subtle)] bg-[var(--color-surface)]'>
          {events.map((e, i) => (
            <tr key={i}>
              <td
                className={`px-2 py-1 text-xs font-medium ${e.type === 'Warning' ? 'text-[var(--color-health-yellow)]' : 'text-[var(--color-text-secondary)]'}`}
              >
                {e.type}
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-secondary)]'>
                {e.reason}
              </td>
              <td
                className='px-2 py-1 text-xs text-[var(--color-text-secondary)] max-w-xs truncate'
                title={e.message}
              >
                {e.message}
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-muted)]'>
                {e.count}
              </td>
              <td className='px-2 py-1 text-xs text-[var(--color-text-muted)]'>
                {e.lastSeen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceDetail({
  resource,
  onClose,
  onNavigate,
}: ResourceDetailProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);

    const { kind, cluster, namespace, name } = resource;

    let promise: Promise<DetailData>;
    switch (kind) {
      case 'pod':
        promise = getPodDetail(cluster, namespace, name).then((d) => ({
          ...d,
          _kind: 'pod' as const,
        }));
        break;
      case 'service':
        promise = getServiceDetail(cluster, namespace, name).then((d) => ({
          ...d,
          _kind: 'service' as const,
        }));
        break;
      case 'deployment':
        promise = getDeploymentDetail(cluster, namespace, name).then((d) => ({
          ...d,
          _kind: 'deployment' as const,
        }));
        break;
      case 'ingress':
        promise = getIngressDetail(cluster, namespace, name).then((d) => ({
          ...d,
          _kind: 'ingress' as const,
        }));
        break;
      case 'node':
        promise = getNodeDetail(cluster, name).then((d) => ({
          ...d,
          _kind: 'node' as const,
        }));
        break;
    }

    promise
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load details'),
      )
      .finally(() => setLoading(false));
  }, [resource]);

  const kindLabel =
    resource.kind.charAt(0).toUpperCase() + resource.kind.slice(1);

  return (
    <div className='fixed inset-0 z-50 flex'>
      <div
        className='absolute inset-0 bg-[var(--color-overlay)]'
        onClick={onClose}
      />
      <div className='relative ml-auto h-full w-full max-w-2xl overflow-y-auto bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-xl animate-[slideInRight_0.2s_ease-out]'>
        {/* Header */}
        <div className='sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4'>
          <div>
            <div className='text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold'>
              {kindLabel}
            </div>
            <h2 className='text-sm font-semibold font-mono text-[var(--color-text-primary)]'>
              {resource.name}
            </h2>
            {resource.namespace && (
              <span className='text-xs text-[var(--color-text-muted)]'>
                {resource.namespace} · {resource.cluster}
              </span>
            )}
            {!resource.namespace && (
              <span className='text-xs text-[var(--color-text-muted)]'>
                {resource.cluster}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className='flex h-8 w-8 items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors'
          >
            <svg
              className='h-5 w-5'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth='2'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className='px-6 py-4'>
          {loading && (
            <div className='flex justify-center py-12'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent' />
            </div>
          )}
          {error && (
            <div className='rounded-lg border border-[var(--color-health-red)]/20 bg-[var(--color-health-red)]/5 p-3 text-xs text-[var(--color-health-red)]'>
              {error}
            </div>
          )}
          {data?._kind === 'pod' && (
            <PodDetailView data={data} onNavigate={onNavigate} />
          )}
          {data?._kind === 'service' && (
            <ServiceDetailView data={data} onNavigate={onNavigate} />
          )}
          {data?._kind === 'deployment' && (
            <DeploymentDetailView data={data} onNavigate={onNavigate} />
          )}
          {data?._kind === 'ingress' && <IngressDetailView data={data} />}
          {data?._kind === 'node' && (
            <NodeDetailView data={data} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}
