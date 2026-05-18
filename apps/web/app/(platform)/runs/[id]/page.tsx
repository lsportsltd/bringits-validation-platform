'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, AlertTriangle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { RunTimeline } from '@/components/RunTimeline';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import type { FlowRun } from '@/lib/types';

export default function RunDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [run, setRun] = useState<FlowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.runs.getFlow(params.id)
      .then(setRun)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  const copyCorrelationId = () => {
    if (run?.correlationId) {
      navigator.clipboard.writeText(run.correlationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (notFound || !run) return <div className="p-8 text-red-400">Run not found</div>;

  const commandRuns = run.commandRuns || [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/runs" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{run.flowName}</h1>
          <p className="text-gray-400 text-sm mt-0.5">Flow Run Details</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge status={run.status} size="md" />
          <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono">{run.env}</span>
          {run.durationMs && (
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <Clock size={13} /> {run.durationMs}ms
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Correlation ID</div>
            <button
              onClick={copyCorrelationId}
              className="flex items-center gap-1.5 font-mono text-gray-300 hover:text-white transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {run.correlationId}
            </button>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Started</div>
            <div className="text-gray-300">{new Date(run.startedAt).toLocaleString()}</div>
          </div>
          {run.finishedAt && (
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Finished</div>
              <div className="text-gray-300">{new Date(run.finishedAt).toLocaleString()}</div>
            </div>
          )}
          {run.failedCommandName && (
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Failed at command</div>
              <div className="font-mono text-red-400">{run.failedCommandName}</div>
            </div>
          )}
        </div>

        {run.failureBoundary && (
          <div className="flex items-center gap-2 p-3 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
            <AlertTriangle size={14} className="shrink-0" />
            <span><strong>Failure boundary:</strong> {run.failureBoundary}</span>
          </div>
        )}

        {run.summary && (
          <p className="text-sm text-gray-300 p-3 rounded bg-gray-800">{run.summary}</p>
        )}
      </div>

      {/* Command Timeline */}
      {commandRuns.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Command Timeline ({commandRuns.length} commands)
          </h2>
          <RunTimeline commandRuns={commandRuns} />
        </div>
      )}

      {/* Variables */}
      {run.variablesSnapshot && Object.keys(run.variablesSnapshot).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <EvidenceViewer evidence={run.variablesSnapshot} title="Variables Snapshot" />
        </div>
      )}

      {/* Full Report */}
      {run.report && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <EvidenceViewer evidence={run.report} title="Full Report" />
        </div>
      )}
    </div>
  );
}
