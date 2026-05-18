'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ConnStatus {
  name: string;
  type: 'postgres' | 'redis' | 'kafka';
  status: 'connected' | 'error' | 'checking';
  latencyMs?: number;
  error?: string;
  meta?: Record<string, any>;
}

// ── Tech SVG logos ─────────────────────────────────────────────────────────────

function PostgresIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="11" rx="9" ry="5.5" stroke="#4A90D9" strokeWidth="2" fill="none"/>
      <path d="M7 11 C7 11 7 22 16 22 C25 22 25 11 25 11" stroke="#4A90D9" strokeWidth="2" fill="none"/>
      <ellipse cx="22" cy="9" rx="3" ry="4" stroke="#4A90D9" strokeWidth="1.5" fill="none"/>
      <path d="M25 9 L25 20" stroke="#4A90D9" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 22 L16 28" stroke="#4A90D9" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 26 C13 26 13 28 16 28 C19 28 19 26 19 26" stroke="#4A90D9" strokeWidth="1.5"/>
    </svg>
  );
}

function RedisIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="22" rx="11" ry="4" fill="#D63A31" opacity="0.3"/>
      <ellipse cx="16" cy="22" rx="11" ry="4" stroke="#D63A31" strokeWidth="1.5" fill="none"/>
      <rect x="5" y="10" width="22" height="12" rx="0" fill="none"/>
      <ellipse cx="16" cy="10" rx="11" ry="4" fill="#D63A31" opacity="0.8"/>
      <path d="M5 10 L5 22" stroke="#D63A31" strokeWidth="1.5"/>
      <path d="M27 10 L27 22" stroke="#D63A31" strokeWidth="1.5"/>
      <text x="16" y="14" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="monospace">REDIS</text>
    </svg>
  );
}

function KafkaIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="3.5" fill="#A855F7"/>
      <circle cx="8" cy="10" r="2.5" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
      <circle cx="8" cy="22" r="2.5" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
      <circle cx="24" cy="10" r="2.5" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
      <circle cx="24" cy="22" r="2.5" fill="none" stroke="#A855F7" strokeWidth="1.5"/>
      <line x1="12.5" y1="14" x2="10" y2="11.5" stroke="#A855F7" strokeWidth="1.5"/>
      <line x1="12.5" y1="18" x2="10" y2="20.5" stroke="#A855F7" strokeWidth="1.5"/>
      <line x1="19.5" y1="14" x2="22" y2="11.5" stroke="#A855F7" strokeWidth="1.5"/>
      <line x1="19.5" y1="18" x2="22" y2="20.5" stroke="#A855F7" strokeWidth="1.5"/>
    </svg>
  );
}

const ICONS: Record<string, React.FC<{ size?: number }>> = {
  postgres: PostgresIcon,
  redis: RedisIcon,
  kafka: KafkaIcon,
};

const TYPE_LABEL: Record<string, string> = {
  postgres: 'PostgreSQL',
  redis: 'Redis',
  kafka: 'Apache Kafka',
};

const TYPE_BG: Record<string, string> = {
  postgres: 'rgba(74,144,217,0.06)',
  redis:    'rgba(214,58,49,0.06)',
  kafka:    'rgba(168,85,247,0.06)',
};

const TYPE_BORDER: Record<string, string> = {
  postgres: 'rgba(74,144,217,0.2)',
  redis:    'rgba(214,58,49,0.2)',
  kafka:    'rgba(168,85,247,0.2)',
};

const TYPE_ACCENT: Record<string, string> = {
  postgres: '#4A90D9',
  redis:    '#D63A31',
  kafka:    '#A855F7',
};

function latencyLabel(ms: number) {
  if (ms < 200) return { label: 'fast', color: '#10b981' };
  if (ms < 600) return { label: 'ok', color: '#f59e0b' };
  return { label: 'slow', color: '#94a3b8' };
}

function ConnectionCard({ s }: { s: ConnStatus }) {
  const isOk = s.status === 'connected';
  const Icon = ICONS[s.type];
  const accent = TYPE_ACCENT[s.type];
  const lat = isOk && s.latencyMs ? latencyLabel(s.latencyMs) : null;

  return (
    <div style={{
      background: isOk ? TYPE_BG[s.type] : 'rgba(239,68,68,0.04)',
      border: `1px solid ${isOk ? TYPE_BORDER[s.type] : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isOk ? accent : '#ef4444',
        borderRadius: '16px 16px 0 0',
      }} />

      {/* Top row: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: isOk ? `${accent}18` : 'rgba(239,68,68,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={26} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              {s.name.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              {TYPE_LABEL[s.type]}
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          background: isOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${isOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
        }}>
          {isOk
            ? <span style={{ width: 6, height: 6, borderRadius: 3, background: '#10b981', display: 'block' }} />
            : <span style={{ width: 6, height: 6, borderRadius: 3, background: '#ef4444', display: 'block' }} />
          }
          <span style={{ fontSize: 11, fontWeight: 600, color: isOk ? '#10b981' : '#ef4444' }}>
            {isOk ? 'connected' : 'error'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {!isOk && s.error && (
        <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'monospace', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
          {s.error}
        </div>
      )}

      {/* Metadata */}
      {isOk && s.meta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Postgres */}
          {s.type === 'postgres' && <>
            <MetaRow label="Database" value={s.meta.db} accent={accent} />
            <MetaRow label="Version" value={s.meta.version} accent={accent} />
          </>}

          {/* Redis */}
          {s.type === 'redis' && <>
            <MetaRow label="Version" value={`Redis ${s.meta.version}`} accent={accent} />
          </>}

          {/* Kafka */}
          {s.type === 'kafka' && <>
            <MetaRow label="Total topics" value={String(s.meta.totalTopics)} accent={accent} />
            {s.meta.monitoredTopics?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Monitored topics
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {s.meta.monitoredTopics.map((t: any) => (
                    <div key={t.topic} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(168,85,247,0.06)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.12)' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#c4b5fd' }}>{t.topic}</span>
                      {t.totalMessages !== null && (
                        <span style={{ fontSize: 10, color: '#64748b' }}>{Number(t.totalMessages).toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}
        </div>
      )}

      {/* Latency footer */}
      {isOk && s.latencyMs && lat && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Latency</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{ width: `${Math.min(100, (s.latencyMs / 2000) * 100)}%`, height: '100%', background: accent, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{s.latencyMs}ms</span>
            <span style={{ fontSize: 10, color: lat.color, fontWeight: 600 }}>· {lat.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [statuses, setStatuses] = useState<ConnStatus[]>([]);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      const res = refresh ? await api.connections.refresh() : await api.connections.get();
      setStatuses(res.statuses);
      setLastChecked(res.lastChecked);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(), lastChecked ? 60_000 : 3_000);
    return () => clearInterval(t);
  }, [load, lastChecked]);

  const connected = statuses.filter(s => s.status === 'connected').length;
  const total     = statuses.length;

  const groups: Record<string, ConnStatus[]> = {
    postgres: statuses.filter(s => s.type === 'postgres'),
    redis:    statuses.filter(s => s.type === 'redis'),
    kafka:    statuses.filter(s => s.type === 'kafka'),
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#f1f5f9', padding: '32px 36px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            Infrastructure Connections
          </h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
            {loading
              ? 'Probing connections...'
              : `${connected} of ${total} connected${lastChecked ? ` · ${new Date(lastChecked).toLocaleTimeString()}` : ''}`
            }
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8', fontSize: 12, fontWeight: 600,
            cursor: refreshing || loading ? 'not-allowed' : 'pointer',
            opacity: refreshing || loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
          {(['postgres', 'redis', 'kafka'] as const).map((type, ci) => {
            const list = groups[type];
            const ok   = list.filter(s => s.status === 'connected').length;
            const all  = list.length;
            const Icon = ICONS[type];
            const isAllOk = ok === all && all > 0;
            return (
              <div key={type} className="conn-card" style={{ animationDelay: `${ci * 60}ms` }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 10,
                  background: isAllOk ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${isAllOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <Icon size={14} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{TYPE_LABEL[type]}</span>
                  <span style={{ fontSize: 11, color: isAllOk ? '#10b981' : '#ef4444', fontWeight: 700 }}>{ok}/{all}</span>
                  {isAllOk
                    ? <CheckCircle2 size={11} color="#10b981" />
                    : <XCircle size={11} color="#ef4444" />
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', marginTop: 60, justifyContent: 'center' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Probing all connections...</span>
        </div>
      )}

      {/* Cards */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {(['postgres', 'redis', 'kafka'] as const).map(type => {
            const list = groups[type];
            if (!list.length) return null;
            const GroupIcon = ICONS[type];
            return (
              <div key={type}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <GroupIcon size={16} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {TYPE_LABEL[type]}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                  {list.map((s, i) => (
                    <div key={s.name} className="conn-card" style={{ animationDelay: `${i * 80}ms` }}>
                      <ConnectionCard s={s} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .conn-card {
          animation: slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>
  );
}
