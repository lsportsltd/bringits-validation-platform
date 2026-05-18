'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Play, Save, Plus, Trash2, ChevronDown, ChevronRight,
  Globe, Database, Server, BarChart2, Box, FileText, Cpu, X, Check,
  Clock, AlertCircle, ArrowUp, ArrowDown, Copy, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Flow, FlowCommand, CommandTemplate, CommandType } from '@/lib/types';

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  http:       { icon: Globe,    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', label: 'HTTP' },
  redis:      { icon: Server,   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: 'Redis' },
  postgres:   { icon: Database, color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   label: 'Postgres' },
  kafka:      { icon: BarChart2,color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Kafka' },
  kubernetes: { icon: Cpu,      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   label: 'K8S' },
  storage:    { icon: Box,      color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Storage' },
  logs:       { icon: FileText, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  label: 'Logs' },
};

const DEFAULT_CONFIGS: Record<string, { config: any; expect: any }> = {
  http: {
    config: { url: '', headers: {}, body: {} },
    expect: { statusCode: 200 },
  },
  redis: {
    config: { connection: 'proxy_redis', keyPattern: '', key: '' },
    expect: { minKeys: 1, exists: true },
  },
  postgres: {
    config: { connection: 'proxy_readonly', query: 'SELECT 1' },
    expect: { rows: 1 },
  },
  kafka: {
    config: { topic: '', consumerGroup: '' },
    expect: { minMessages: 1 },
  },
  kubernetes: {
    config: { namespace: '', deployment: '' },
    expect: { minReadyReplicas: 1, maxRestartsLast10m: 0 },
  },
  storage: {
    config: { provider: 'mock', bucket: '', path: '' },
    expect: { exists: true },
  },
  logs: {
    config: { provider: 'mock', query: { env: '', service: '' } },
    expect: { minResults: 1 },
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowBuilderPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [commandTypes, setCommandTypes] = useState<CommandType[]>([]);
  const [commandTemplates, setCommandTemplates] = useState<CommandTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCmd, setSelectedCmd] = useState<FlowCommand | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<Record<string, any>>({});
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');

  // Flow settings state
  const [flowName, setFlowName] = useState('');
  const [flowDesc, setFlowDesc] = useState('');
  const [flowEnv, setFlowEnv] = useState('qa');
  const [flowTags, setFlowTags] = useState('');
  const [flowVars, setFlowVars] = useState('{}');

  const load = useCallback(async () => {
    const [f, types, templates] = await Promise.all([
      api.flows.get(params.id),
      api.meta.commandTypes(),
      api.commands.list(),
    ]);
    setFlow(f);
    setCommandTypes(types);
    setCommandTemplates(templates);
    setFlowName(f.name);
    setFlowDesc(f.description || '');
    setFlowEnv(f.env);
    setFlowTags((f.tags || []).join(', '));
    setFlowVars(JSON.stringify(f.variables || {}, null, 2));
    setLoading(false);
    // Refresh selected command if open
    setSelectedCmd((prev) => prev ? (f.commands || []).find((c: FlowCommand) => c.id === prev.id) || null : null);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      let vars = {};
      try { vars = JSON.parse(flowVars); } catch {}
      await api.flows.update(params.id, {
        name: flowName, description: flowDesc, env: flowEnv,
        tags: flowTags.split(',').map((t) => t.trim()).filter(Boolean),
        variables: vars,
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const addCommandOfType = async (type: string, action: string) => {
    const defaults = DEFAULT_CONFIGS[type] || { config: {}, expect: {} };
    const name = `${type}_${action}_${(flow?.commands?.length || 0) + 1}`;
    await api.flows.addCommand(params.id, {
      name, type, action,
      config: defaults.config,
      expect: defaults.expect,
      timeoutSeconds: 30,
      continueOnFailure: false,
    });
    await load();
  };

  const addFromTemplate = async (t: CommandTemplate) => {
    await api.flows.addCommand(params.id, {
      name: t.name,
      type: t.type,
      action: t.action,
      config: t.config,
      expect: t.expect || {},
      timeoutSeconds: t.timeoutSeconds,
      continueOnFailure: false,
      commandTemplateId: t.id,
    });
    await load();
  };

  const removeCommand = async (cmdId: string) => {
    if (selectedCmd?.id === cmdId) setSelectedCmd(null);
    await api.flows.deleteCommand(params.id, cmdId);
    await load();
  };

  const moveCommand = async (cmdId: string, direction: 'up' | 'down') => {
    const cmds = flow?.commands || [];
    const idx = cmds.findIndex((c) => c.id === cmdId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cmds.length - 1) return;
    const swapWith = cmds[direction === 'up' ? idx - 1 : idx + 1];
    await Promise.all([
      api.flows.updateCommand(params.id, cmdId, { ...cmds[idx], orderIndex: swapWith.orderIndex }),
      api.flows.updateCommand(params.id, swapWith.id, { ...swapWith, orderIndex: cmds[idx].orderIndex }),
    ]);
    await load();
  };

  const quickRun = async () => {
    if (running) return;
    setRunning(true);
    setRunStatus('running');
    setRunResults({});

    // Mark all commands as "running"
    const cmds = [...(flow?.commands || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const initial: Record<string, any> = {};
    cmds.forEach((c) => { initial[c.name] = { status: 'running' }; });
    setRunResults(initial);

    try {
      let vars = {};
      try { vars = JSON.parse(flowVars); } catch {}
      const result = await api.flows.run(params.id, { variables: vars });
      const byName: Record<string, any> = {};
      (result.commandResults || []).forEach((r: any) => { byName[r.commandName] = r; });
      setRunResults(byName);
      setRunStatus(result.status === 'passed' ? 'passed' : 'failed');
    } catch (err: any) {
      setRunStatus('failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
      Loading flow...
    </div>
  );
  if (!flow) return <div className="p-8 text-red-400">Flow not found</div>;

  const commands = [...(flow.commands || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/flows" className="text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-white font-semibold text-sm">{flow.name}</h1>
            <p className="text-gray-500 text-xs font-mono">{flow.env} · {commands.length} commands</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSettings(!showSettings); setSelectedCmd(null); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
          >
            Settings
          </button>
          <Link
            href={`/flows/${params.id}/run`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Play size={12} /> Run Flow
          </Link>
        </div>
      </div>

      {/* ── Body: 3 columns ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: Command Catalog ── */}
        <div className="w-56 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add commands</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {/* Command Types */}
            {commandTypes.map((ct) => (
              <CatalogSection key={ct.type} label={TYPE_META[ct.type]?.label || ct.type}>
                {ct.actions.map((action) => (
                  <CatalogItem
                    key={action}
                    label={action}
                    type={ct.type}
                    onClick={() => addCommandOfType(ct.type, action)}
                  />
                ))}
              </CatalogSection>
            ))}
          </div>
        </div>

        {/* ── CENTER: Flow Canvas ── */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          <div className="flex flex-col items-center py-8 min-h-full">
            {/* Start node + Run button */}
            <div className="flex flex-col items-center gap-2">
              <FlowStartEnd label="START" />
              {commands.length > 0 && (
                <button
                  onClick={quickRun}
                  disabled={running}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-lg ${
                    running
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : runStatus === 'passed'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : runStatus === 'failed'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {running
                    ? <><Loader2 size={11} className="animate-spin" /> Running...</>
                    : runStatus === 'passed'
                    ? <><CheckCircle2 size={11} /> Passed</>
                    : runStatus === 'failed'
                    ? <><XCircle size={11} /> Failed — Run again</>
                    : <><Play size={11} /> Run</>
                  }
                </button>
              )}
            </div>

            {commands.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <FlowConnector />
                <div className="border border-dashed border-gray-700 rounded-xl px-8 py-6 text-center text-gray-500 text-sm">
                  <Plus size={20} className="mx-auto mb-2 text-gray-600" />
                  Add commands from the left sidebar
                </div>
              </div>
            ) : (
              commands.map((cmd, i) => (
                <div key={cmd.id} className="flex flex-col items-center w-full">
                  <FlowConnector result={runResults[cmd.name]} />
                  <FlowNode
                    cmd={cmd}
                    index={i}
                    total={commands.length}
                    selected={selectedCmd?.id === cmd.id}
                    result={runResults[cmd.name]}
                    onClick={() => { setSelectedCmd(cmd); setShowSettings(false); }}
                    onDelete={() => removeCommand(cmd.id)}
                    onMoveUp={() => moveCommand(cmd.id, 'up')}
                    onMoveDown={() => moveCommand(cmd.id, 'down')}
                  />
                </div>
              ))
            )}

            <FlowConnector />
            <FlowStartEnd label="END" />
          </div>
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        {(selectedCmd || showSettings) && (
          <div className="w-96 shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
            {showSettings ? (
              <SettingsPanel
                name={flowName} setName={setFlowName}
                desc={flowDesc} setDesc={setFlowDesc}
                env={flowEnv} setEnv={setFlowEnv}
                tags={flowTags} setTags={setFlowTags}
                vars={flowVars} setVars={setFlowVars}
                saving={saving} onSave={saveSettings}
                onClose={() => setShowSettings(false)}
              />
            ) : selectedCmd ? (
              <CommandDetailPanel
                key={selectedCmd.id}
                cmd={selectedCmd}
                flowId={params.id}
                onClose={() => setSelectedCmd(null)}
                onSaved={load}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flow visual elements ──────────────────────────────────────────────────────

function FlowStartEnd({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs font-mono text-gray-400">
      <span className={`w-2 h-2 rounded-full ${label === 'START' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
      {label}
    </div>
  );
}

function FlowConnector({ result }: { result?: any }) {
  const color = !result ? 'bg-gray-700'
    : result.status === 'passed' ? 'bg-emerald-500'
    : result.status === 'failed' ? 'bg-red-500'
    : 'bg-yellow-500';
  const dotColor = !result ? 'bg-gray-600'
    : result.status === 'passed' ? 'bg-emerald-400'
    : result.status === 'failed' ? 'bg-red-400'
    : 'bg-yellow-400 animate-pulse';
  return (
    <div className="flex flex-col items-center">
      <div className={`w-px h-4 ${color} transition-colors`} />
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} transition-colors`} />
      <div className={`w-px h-4 ${color} transition-colors`} />
    </div>
  );
}

function FlowNode({ cmd, index, total, selected, result, onClick, onDelete, onMoveUp, onMoveDown }: {
  cmd: FlowCommand; index: number; total: number; selected: boolean; result?: any;
  onClick: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const meta = TYPE_META[cmd.type] || { icon: Globe, color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700', label: cmd.type };
  const Icon = meta.icon;

  const resultBorder = !result ? ''
    : result.status === 'passed' ? 'ring-1 ring-emerald-500/50'
    : result.status === 'failed' ? 'ring-1 ring-red-500/50'
    : 'ring-1 ring-yellow-500/50';

  return (
    <div className="relative group w-full max-w-lg px-4">
      {/* Status badge above node */}
      {result && (
        <div className="flex justify-center mb-1">
          {result.status === 'running' ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-mono">
              <Loader2 size={9} className="animate-spin" /> running
            </span>
          ) : result.status === 'passed' ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <CheckCircle2 size={9} /> passed {result.durationMs ? `· ${result.durationMs}ms` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono">
              <XCircle size={9} /> failed {result.durationMs ? `· ${result.durationMs}ms` : ''}
            </span>
          )}
        </div>
      )}
      <div
        onClick={onClick}
        className={`
          relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all
          ${resultBorder}
          ${selected
            ? `${meta.border} ${meta.bg} shadow-lg ring-1 ring-inset ring-white/5`
            : 'border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-850'
          }
        `}
      >
        {/* Index */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 text-xs font-mono text-gray-500 font-bold">
            {index + 1}
          </span>
        </div>

        {/* Icon */}
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} ${meta.border} border mt-0.5`}>
          <Icon size={15} className={meta.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-white truncate">{cmd.name}</span>
            {cmd.continueOnFailure && (
              <span className="px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">skip on fail</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-semibold ${meta.color}`}>{meta.label}</span>
            <span className="text-gray-600">·</span>
            <span className="text-xs text-gray-400 font-mono">{cmd.action}</span>
            <span className="text-gray-600">·</span>
            <Clock size={10} className="text-gray-600" />
            <span className="text-xs text-gray-500">{cmd.timeoutSeconds}s</span>
          </div>
          {/* Config preview */}
          <ConfigPreview cmd={cmd} />
        </div>

        {/* Actions */}
        <div
          className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {index > 0 && (
            <button onClick={onMoveUp} className="p-1 text-gray-600 hover:text-gray-300 rounded">
              <ArrowUp size={12} />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={onMoveDown} className="p-1 text-gray-600 hover:text-gray-300 rounded">
              <ArrowDown size={12} />
            </button>
          )}
          <button onClick={onDelete} className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigPreview({ cmd }: { cmd: FlowCommand }) {
  const c = cmd.config as any;
  if (cmd.type === 'http' && c.url) {
    return <p className="text-xs text-gray-500 font-mono mt-1.5 truncate">{c.url}</p>;
  }
  if (cmd.type === 'postgres' && c.query) {
    return <p className="text-xs text-gray-500 font-mono mt-1.5 truncate">{c.query}</p>;
  }
  if (cmd.type === 'redis' && c.keyPattern) {
    return <p className="text-xs text-gray-500 font-mono mt-1.5">key: {c.keyPattern}</p>;
  }
  if (cmd.type === 'kubernetes' && c.deployment) {
    return <p className="text-xs text-gray-500 font-mono mt-1.5">{c.namespace}/{c.deployment}</p>;
  }
  return null;
}

// ─── Left Catalog ─────────────────────────────────────────────────────────────

function CatalogSection({ label, children, defaultOpen = false }: {
  label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors"
      >
        {label}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function CatalogItem({ label, sublabel, type, onClick }: {
  label: string; sublabel?: string; type: string; onClick: () => void;
}) {
  const meta = TYPE_META[type] || { icon: Globe, color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700', label: type };
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-gray-800 transition-colors text-left group"
    >
      <Icon size={13} className={`${meta.color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-gray-300 font-mono truncate group-hover:text-white transition-colors">{label}</p>
        {sublabel && <p className="text-xs text-gray-600 font-mono truncate">{sublabel}</p>}
      </div>
      <Plus size={11} className="ml-auto text-gray-600 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
    </button>
  );
}

// ─── Right: Command Detail Panel ──────────────────────────────────────────────

function CommandDetailPanel({ cmd, flowId, onClose, onSaved }: {
  cmd: FlowCommand; flowId: string; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(cmd.name);
  const [timeoutSeconds, setTimeoutSeconds] = useState(cmd.timeoutSeconds);
  const [continueOnFailure, setContinueOnFailure] = useState(cmd.continueOnFailure);
  const [config, setConfig] = useState<any>(cmd.config);
  const [expect, setExpect] = useState<any>(cmd.expect || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const meta = TYPE_META[cmd.type] || { icon: Globe, color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700', label: cmd.type };
  const Icon = meta.icon;

  const save = async () => {
    setSaving(true);
    try {
      await api.flows.updateCommand(flowId, cmd.id, {
        name, type: cmd.type, action: cmd.action,
        orderIndex: cmd.orderIndex, config, expect,
        timeoutSeconds, continueOnFailure,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className={`px-4 py-3 border-b border-gray-800 ${meta.bg} shrink-0`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.bg} border ${meta.border}`}>
              <Icon size={13} className={meta.color} />
            </div>
            <div>
              <p className={`text-xs font-semibold ${meta.color}`}>{meta.label} · {cmd.action}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Name input inline */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent font-mono text-sm font-semibold text-white placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-gray-600 pb-0.5 transition-colors"
          placeholder="command_name"
        />
      </div>

      {/* Panel body - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Type-specific config */}
        <div className="p-4 border-b border-gray-800">
          <SectionLabel>Configuration</SectionLabel>
          <ConfigEditor type={cmd.type} action={cmd.action} config={config} onChange={setConfig} />
        </div>

        {/* Expectations */}
        <div className="p-4 border-b border-gray-800">
          <SectionLabel>Expected Result</SectionLabel>
          <ExpectEditor type={cmd.type} expect={expect} onChange={setExpect} />
        </div>

        {/* Run settings */}
        <div className="p-4">
          <SectionLabel>Run Settings</SectionLabel>
          <div className="space-y-3">
            <Field label="Timeout (seconds)">
              <input
                type="number"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setContinueOnFailure(!continueOnFailure)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${continueOnFailure ? 'bg-yellow-500' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${continueOnFailure ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-400">Continue on failure</span>
            </label>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-gray-800 shrink-0">
        <button
          onClick={save}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'
          }`}
        >
          {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : <><Save size={14} /> Save Command</>}
        </button>
      </div>
    </div>
  );
}

// ─── Config editors per type ──────────────────────────────────────────────────

function ConfigEditor({ type, action, config, onChange }: {
  type: string; action: string; config: any; onChange: (v: any) => void;
}) {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });
  const setNested = (key: string, nestedKey: string, value: any) =>
    onChange({ ...config, [key]: { ...(config[key] || {}), [nestedKey]: value } });

  if (type === 'http') return (
    <div className="space-y-3">
      <Field label="URL">
        <input
          value={config.url || ''}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://service.qa.internal/path/{{variables.id}}"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </Field>
      <KeyValueEditor
        label="Headers"
        value={config.headers || {}}
        onChange={(v) => set('headers', v)}
        placeholder={{ key: 'x-correlation-id', value: '{{correlation_id}}' }}
      />
      {['post', 'put', 'patch'].includes(action) && (
        <Field label="Body">
          <JsonTextarea
            value={config.body || {}}
            onChange={(v) => set('body', v)}
            rows={5}
          />
        </Field>
      )}
      {action === 'get' && (
        <KeyValueEditor
          label="Query Params"
          value={config.query || {}}
          onChange={(v) => set('query', v)}
          placeholder={{ key: 'page', value: '1' }}
        />
      )}
    </div>
  );

  if (type === 'postgres') {
    const KNOWN_CONNECTIONS = ['link_api', 'link_api_ro'];
    const isWrite = action === 'execute';
    return (
      <div className="space-y-3">
        <Field label="Connection">
          <select
            value={config.connection || ''}
            onChange={(e) => set('connection', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— select connection —</option>
            {KNOWN_CONNECTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={isWrite ? 'Query (INSERT / UPDATE / DELETE)' : 'Query (SELECT only)'}>
          <textarea
            value={config.query || ''}
            onChange={(e) => set('query', e.target.value)}
            rows={6}
            placeholder={isWrite
              ? `DELETE FROM tenants WHERE id = '{{outputs.create_tenant.responseBody.id}}'`
              : `SELECT id, name FROM tenants WHERE id = '{{outputs.create_tenant.responseBody.id}}'`}
            className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-xs font-mono focus:outline-none resize-none ${
              isWrite
                ? 'border-orange-700/50 focus:ring-1 focus:ring-orange-500'
                : 'border-gray-700 focus:ring-1 focus:ring-blue-500'
            }`}
          />
        </Field>
        {isWrite && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertCircle size={12} className="text-orange-400 shrink-0" />
            <span className="text-orange-400 text-xs">Write query — runs directly against the DB. DROP/ALTER/TRUNCATE are blocked.</span>
          </div>
        )}
      </div>
    );
  }

  if (type === 'redis') return (
    <div className="space-y-3">
      <Field label="Connection">
        <select
          value={config.connection || ''}
          onChange={(e) => set('connection', e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">— select connection —</option>
          <option value="link_clustered">link_clustered</option>
          <option value="black_widow_clustered">black_widow_clustered</option>
          <option value="data_clustered">data_clustered</option>
          <option value="link_qa">link_qa</option>
        </select>
      </Field>
      {['keys', 'find_key'].includes(action) && (
        <Field label="Key Pattern">
          <input
            value={config.pattern ?? config.keyPattern ?? ''}
            onChange={(e) => onChange({ ...config, pattern: e.target.value, keyPattern: e.target.value })}
            placeholder="{tenantId:domain}:pool"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <p className="text-xs text-gray-500 mt-1">Supports <span className="font-mono text-gray-400">*</span> glob and <span className="font-mono text-gray-400">{'{{interpolation}}'}</span></p>
        </Field>
      )}
      {['get', 'set', 'del', 'exists', 'ttl', 'get_value', 'set_value', 'delete_key'].includes(action) && (
        <Field label="Key">
          <input
            value={config.key || ''}
            onChange={(e) => set('key', e.target.value)}
            placeholder="proxy:{{variables.proxy_id}}"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </Field>
      )}
      {['hget', 'hgetall'].includes(action) && (
        <>
          <Field label="Key">
            <input
              value={config.key || ''}
              onChange={(e) => set('key', e.target.value)}
              placeholder="hash:{{variables.id}}"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </Field>
          {action === 'hget' && (
            <Field label="Field">
              <input
                value={config.field || ''}
                onChange={(e) => set('field', e.target.value)}
                placeholder="fieldName"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </Field>
          )}
        </>
      )}
      {(action === 'set' || action === 'set_value') && (
        <Field label="Value">
          <JsonTextarea value={config.value || {}} onChange={(v) => set('value', v)} rows={3} />
        </Field>
      )}
    </div>
  );

  if (type === 'kubernetes') return (
    <div className="space-y-3">
      <Field label="Namespace">
        <input
          value={config.namespace || ''}
          onChange={(e) => set('namespace', e.target.value)}
          placeholder="black-widow-qa"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </Field>
      <Field label="Deployment">
        <input
          value={config.deployment || ''}
          onChange={(e) => set('deployment', e.target.value)}
          placeholder="proxy-service"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </Field>
    </div>
  );

  if (type === 'logs') return (
    <div className="space-y-3">
      <Field label="Provider">
        <select
          value={config.provider || 'mock'}
          onChange={(e) => set('provider', e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="mock">mock</option>
          <option value="datadog">datadog</option>
          <option value="coralogix">coralogix</option>
        </select>
      </Field>
      <KeyValueEditor
        label="Query Fields"
        value={config.query || {}}
        onChange={(v) => set('query', v)}
        placeholder={{ key: 'service', value: 'proxy-service' }}
      />
    </div>
  );

  if (type === 'storage') return (
    <div className="space-y-3">
      <Field label="Provider">
        <select
          value={config.provider || 'mock'}
          onChange={(e) => set('provider', e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
        >
          <option value="mock">mock</option>
          <option value="gcs">GCS</option>
          <option value="s3">S3</option>
        </select>
      </Field>
      <Field label="Bucket">
        <input
          value={config.bucket || ''}
          onChange={(e) => set('bucket', e.target.value)}
          placeholder="my-bucket"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </Field>
      <Field label="Path / Object">
        <input
          value={config.path || ''}
          onChange={(e) => set('path', e.target.value)}
          placeholder="{{variables.proxy_id}}/data.json"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </Field>
    </div>
  );

  // Generic fallback
  return (
    <Field label="Config (JSON)">
      <JsonTextarea value={config} onChange={onChange} rows={6} />
    </Field>
  );
}

// ─── Expect editors per type ──────────────────────────────────────────────────

function ExpectEditor({ type, expect, onChange }: {
  type: string; expect: any; onChange: (v: any) => void;
}) {
  const set = (key: string, value: any) => onChange({ ...expect, [key]: value });
  const unset = (key: string) => {
    const next = { ...expect };
    delete next[key];
    onChange(next);
  };

  if (type === 'http') {
    const validateBody = expect.body !== undefined;
    const validateNotContains = (expect.notContainsFields || []).length > 0;
    const validateDuration = !!expect.maxDurationMs;

    return (
      <div className="space-y-4">
        {/* ── Status Code ── */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Expected Status Code</label>
          <div className="flex gap-2 flex-wrap">
            {[200, 201, 204, 400, 401, 403, 404, 500].map((code) => (
              <button
                key={code}
                onClick={() => set('statusCode', code)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  expect.statusCode === code
                    ? code < 400 ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {code}
              </button>
            ))}
            <input
              type="number"
              value={expect.statusCode || ''}
              onChange={(e) => set('statusCode', Number(e.target.value))}
              placeholder="other"
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Only the status code will be validated by default.</p>
        </div>

        {/* ── Optional: Body ── */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => validateBody ? unset('body') : set('body', {})}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-850 hover:bg-gray-800 transition-colors"
          >
            <span className="text-xs font-medium text-gray-400">Validate body fields</span>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${validateBody ? 'bg-violet-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${validateBody ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
          {validateBody && (
            <div className="p-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Partial match — only specified fields are checked</p>
              <JsonTextarea value={expect.body || {}} onChange={(v) => set('body', v)} rows={4} />
            </div>
          )}
        </div>

        {/* ── Optional: Not Contains ── */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => validateNotContains ? unset('notContainsFields') : set('notContainsFields', [])}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-850 hover:bg-gray-800 transition-colors"
          >
            <span className="text-xs font-medium text-gray-400">Fields must NOT exist in response</span>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${validateNotContains ? 'bg-violet-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${validateNotContains ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
          {validateNotContains && (
            <div className="p-3 border-t border-gray-800">
              <input
                value={(expect.notContainsFields || []).join(', ')}
                onChange={(e) => set('notContainsFields', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                placeholder="password, secret, token"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
        </div>

        {/* ── Optional: Duration ── */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => validateDuration ? unset('maxDurationMs') : set('maxDurationMs', 5000)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-850 hover:bg-gray-800 transition-colors"
          >
            <span className="text-xs font-medium text-gray-400">Max duration (ms)</span>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${validateDuration ? 'bg-violet-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${validateDuration ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
          {validateDuration && (
            <div className="p-3 border-t border-gray-800">
              <input
                type="number"
                value={expect.maxDurationMs || ''}
                onChange={(e) => set('maxDurationMs', Number(e.target.value) || undefined)}
                placeholder="5000"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === 'postgres') return (
    <div className="space-y-3">
      <Field label="Expected Row Count">
        <input
          type="number"
          value={expect.rows ?? ''}
          onChange={(e) => set('rows', Number(e.target.value))}
          placeholder="1"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </Field>
      <Field label="First Row Must Contain">
        <JsonTextarea value={expect.firstRow || {}} onChange={(v) => set('firstRow', v)} rows={4} />
      </Field>
    </div>
  );

  if (type === 'redis') return (
    <div className="space-y-3">
      <Field label="Min Keys">
        <input
          type="number"
          value={expect.minKeys ?? ''}
          onChange={(e) => set('minKeys', Number(e.target.value))}
          placeholder="1"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </Field>
      <Field label="Max Keys (0 = no limit)">
        <input
          type="number"
          value={expect.maxKeys ?? ''}
          onChange={(e) => set('maxKeys', Number(e.target.value))}
          placeholder="0"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </Field>
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => set('exists', !expect.exists)}
          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${expect.exists ? 'bg-emerald-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${expect.exists ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-xs text-gray-400">Key should exist</span>
      </label>
    </div>
  );

  if (type === 'kubernetes') return (
    <div className="space-y-3">
      <Field label="Min Ready Replicas">
        <input
          type="number"
          value={expect.minReadyReplicas ?? 1}
          onChange={(e) => set('minReadyReplicas', Number(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </Field>
      <Field label="Max Restarts Last 10 min">
        <input
          type="number"
          value={expect.maxRestartsLast10m ?? 0}
          onChange={(e) => set('maxRestartsLast10m', Number(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </Field>
    </div>
  );

  if (type === 'logs') return (
    <div className="space-y-3">
      <Field label="Min Results">
        <input
          type="number"
          value={expect.minResults ?? 1}
          onChange={(e) => set('minResults', Number(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </Field>
    </div>
  );

  // Generic
  return (
    <Field label="Expect (JSON)">
      <JsonTextarea value={expect} onChange={onChange} rows={5} />
    </Field>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ name, setName, desc, setDesc, env, setEnv, tags, setTags, vars, setVars, saving, onSave, onClose }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <p className="text-sm font-semibold text-gray-200">Flow Settings</p>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="Flow Name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </Field>
        <Field label="Description">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none" />
        </Field>
        <Field label="Environment">
          <select value={env} onChange={(e) => setEnv(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500">
            {['dev', 'qa', 'prod', 'local'].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </Field>
        <Field label="Tags (comma separated)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="proxy, crud"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </Field>
        <Field label="Variables (JSON)">
          <textarea value={vars} onChange={(e) => setVars(e.target.value)} rows={8} spellCheck={false}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none" />
        </Field>
      </div>
      <div className="p-4 border-t border-gray-800 shrink-0">
        <button onClick={onSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function JsonTextarea({ value, onChange, rows = 5 }: { value: any; onChange: (v: any) => void; rows?: number }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(text);
      const canonical = JSON.stringify(value, null, 2);
      if (JSON.stringify(parsed) !== JSON.stringify(value)) {
        setText(canonical);
      }
    } catch {}
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    try {
      const parsed = JSON.parse(raw);
      setError(false);
      onChange(parsed);
    } catch {
      setError(true);
    }
  };

  return (
    <textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      rows={rows}
      spellCheck={false}
      className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 resize-none transition-colors ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-violet-500'
      }`}
    />
  );
}

function KeyValueEditor({ label, value, onChange, placeholder }: {
  label: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  placeholder?: { key: string; value: string };
}) {
  const entries = Object.entries(value || {});

  const setKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const setValue = (key: string, val: string) => onChange({ ...value, [key]: val });
  const removeEntry = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };
  const addEntry = () => onChange({ ...value, '': '' });

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-gray-500">{label}</label>
        <button onClick={addEntry} className="text-xs text-gray-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
          <Plus size={10} /> Add
        </button>
      </div>
      <div className="space-y-1.5">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input
              value={k}
              onChange={(e) => setKey(k, e.target.value)}
              placeholder={placeholder?.key || 'key'}
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <span className="text-gray-600 text-xs">:</span>
            <input
              value={v}
              onChange={(e) => setValue(k, e.target.value)}
              placeholder={placeholder?.value || 'value'}
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button onClick={() => removeEntry(k)} className="text-gray-600 hover:text-red-400 transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-xs text-gray-600 italic">No entries — click + Add</p>
        )}
      </div>
    </div>
  );
}
