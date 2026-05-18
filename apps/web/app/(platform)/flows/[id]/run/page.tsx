'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Copy, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { RunTimeline } from '@/components/RunTimeline';
import { JsonEditor } from '@/components/JsonEditor';
import type { Flow } from '@/lib/types';

export default function FlowRunPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.flows.get(params.id).then((f) => {
      setFlow(f);
      setVariables(f.variables || {});
    }).finally(() => setLoading(false));
  }, [params.id]);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.flows.run(params.id, { variables });
      setResult(res);
    } catch (err: any) {
      setResult({ status: 'failed', errorMessage: err.message, commandResults: [] });
    } finally {
      setRunning(false);
    }
  };

  const copyCorrelationId = () => {
    if (result?.correlationId) {
      navigator.clipboard.writeText(result.correlationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!flow) return <div className="p-8 text-red-400">Flow not found</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/flows/${params.id}/edit`} className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Run Flow</h1>
          <p className="text-gray-400 text-sm mt-0.5 font-mono">{flow.name}</p>
        </div>
      </div>

      {/* Run Configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Configuration</h2>
          <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">{flow.env}</span>
        </div>

        <JsonEditor
          label="Variables (override)"
          value={variables}
          onChange={setVariables}
          height="h-40"
        />

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Play size={16} /> {running ? 'Running...' : 'Run Flow'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-4">
              <StatusBadge status={result.status} size="md" />
              {result.durationMs && (
                <span className="text-sm text-gray-400">{result.durationMs}ms</span>
              )}
              {result.correlationId && (
                <button
                  onClick={copyCorrelationId}
                  className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {result.correlationId}
                </button>
              )}
              {result.flowRunId && (
                <Link
                  href={`/runs/${result.flowRunId}`}
                  className="text-xs text-violet-400 hover:text-violet-300 ml-auto"
                >
                  View full run →
                </Link>
              )}
            </div>

            {result.summary && (
              <p className="text-sm text-gray-300">{result.summary}</p>
            )}

            {result.failureBoundary && (
              <div className="flex items-center gap-2 p-3 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
                <AlertTriangle size={14} className="shrink-0" />
                <span><strong>Failure boundary:</strong> {result.failureBoundary}</span>
              </div>
            )}

            {result.errorMessage && (
              <div className="p-3 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
                {result.errorMessage}
              </div>
            )}
          </div>

          {/* Timeline */}
          {result.commandResults && result.commandResults.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Command Timeline ({result.commandResults.length} commands)
              </h2>
              <RunTimeline
                commandRuns={result.commandResults.map((r: any) => ({
                  id: r.commandName + '-' + r.startedAt,
                  commandName: r.commandName,
                  type: r.type,
                  action: r.action,
                  status: r.status,
                  correlationId: result.correlationId,
                  startedAt: r.startedAt,
                  finishedAt: r.finishedAt,
                  durationMs: r.durationMs,
                  evidence: r.evidence,
                  errorMessage: r.errorMessage,
                  configSnapshot: {},
                  createdAt: r.startedAt,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
