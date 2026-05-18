'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { TypeBadge } from '@/components/TypeBadge';

export default function RunsPage() {
  const [data, setData] = useState<any>({ flowRuns: [], commandRuns: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flows' | 'commands'>('flows');

  const load = () => {
    setLoading(true);
    api.runs.list().then(setData).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flowRuns = data.flowRuns || [];
  const commandRuns = data.commandRuns || [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History size={22} className="text-blue-400" /> Run History
          </h1>
          <p className="text-gray-400 text-sm mt-1">Past command and flow executions</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(['flows', 'commands'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-violet-500 text-violet-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t === 'flows' ? `Flow Runs (${flowRuns.length})` : `Command Runs (${commandRuns.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : tab === 'flows' ? (
        <FlowRunsTable runs={flowRuns} />
      ) : (
        <CommandRunsTable runs={commandRuns} />
      )}
    </div>
  );
}

function FlowRunsTable({ runs }: { runs: any[] }) {
  if (runs.length === 0) return (
    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-lg">
      No flow runs yet. Run a flow to see results here.
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Flow</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Env</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Correlation ID</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Duration</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Failed at</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Started</th>
            <th className="text-right px-4 py-3 text-gray-400 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
              <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
              <td className="px-4 py-3 font-mono text-sm text-white">{run.flowName}</td>
              <td className="px-4 py-3"><span className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-300 font-mono">{run.env}</span></td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">{run.correlationId}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{run.durationMs ? `${run.durationMs}ms` : '—'}</td>
              <td className="px-4 py-3 text-xs text-red-400 font-mono">{run.failedCommandName || '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(run.startedAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/runs/${run.id}`} className="text-xs text-violet-400 hover:text-violet-300">Details →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommandRunsTable({ runs }: { runs: any[] }) {
  if (runs.length === 0) return (
    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-lg">
      No standalone command runs yet.
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Command</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Duration</th>
            <th className="text-left px-4 py-3 text-gray-400 font-medium">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
              <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
              <td className="px-4 py-3 font-mono text-sm text-white">{run.commandName}</td>
              <td className="px-4 py-3"><TypeBadge type={run.type} /></td>
              <td className="px-4 py-3 text-xs text-gray-400">{run.durationMs ? `${run.durationMs}ms` : '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(run.startedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
