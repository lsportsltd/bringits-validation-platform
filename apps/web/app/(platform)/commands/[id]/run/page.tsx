'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import { JsonEditor } from '@/components/JsonEditor';
import type { CommandTemplate } from '@/lib/types';

export default function RunCommandPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [command, setCommand] = useState<CommandTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.commands.get(params.id).then(setCommand).finally(() => setLoading(false));
  }, [params.id]);

  const handleRun = async () => {
    if (!command) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await api.commands.run(params.id, { variables });
      setResult(res);
    } catch (err: any) {
      setResult({ status: 'failed', errorMessage: err.message });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!command) return <div className="p-8 text-red-400">Command not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/commands" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Run Command</h1>
          <p className="text-gray-400 text-sm mt-0.5 font-mono">{command.name}</p>
        </div>
      </div>

      {/* Command Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Type:</span>
            <span className="ml-2 font-mono text-violet-300">{command.type}</span>
          </div>
          <div>
            <span className="text-gray-400">Action:</span>
            <span className="ml-2 font-mono text-violet-300">{command.action}</span>
          </div>
        </div>

        <JsonEditor
          label="Override Variables"
          value={variables}
          onChange={setVariables}
          height="h-32"
          placeholder='{ "proxy_id": "test-123" }'
        />

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Play size={16} /> {running ? 'Running...' : 'Run Command'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <StatusBadge status={result.status} size="md" />
            {result.durationMs !== undefined && (
              <span className="text-sm text-gray-400">{result.durationMs}ms</span>
            )}
            {result.correlationId && (
              <span className="text-xs font-mono text-gray-500">{result.correlationId}</span>
            )}
          </div>

          {result.errorMessage && (
            <div className="p-3 rounded bg-red-950 border border-red-800 text-red-300 text-sm">
              {result.errorMessage}
            </div>
          )}

          {result.evidence && Object.keys(result.evidence).length > 0 && (
            <EvidenceViewer evidence={result.evidence} title="Evidence" />
          )}
        </div>
      )}
    </div>
  );
}
