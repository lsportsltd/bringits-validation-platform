'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Play, Trash2, GitBranch } from 'lucide-react';
import { api } from '@/lib/api';
import type { Flow } from '@/lib/types';

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.flows.list().then(setFlows).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete flow "${name}"?`)) return;
    await api.flows.delete(id);
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch size={22} className="text-blue-400" /> Flows
          </h1>
          <p className="text-gray-400 text-sm mt-1">Multi-step validation flows</p>
        </div>
        <Link
          href="/flows/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Flow
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : flows.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-gray-800 rounded-lg">
          <GitBranch size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-400 mb-4">No flows yet</p>
          <Link href="/flows/new" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-500">
            Create first flow
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Env</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Commands</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tags</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Updated</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/flows/${flow.id}/edit`} className="font-mono font-medium text-white hover:text-violet-300">
                      {flow.name}
                    </Link>
                    {flow.description && <div className="text-xs text-gray-500 mt-0.5">{flow.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300 font-mono">{flow.env}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{(flow as any).commandCount ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(flow.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(flow.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/flows/${flow.id}/run`} title="Run" className="p-1.5 rounded hover:bg-emerald-900 text-gray-400 hover:text-emerald-300 transition-colors">
                        <Play size={14} />
                      </Link>
                      <Link href={`/flows/${flow.id}/edit`} title="Edit" className="p-1.5 rounded hover:bg-blue-900 text-gray-400 hover:text-blue-300 transition-colors">
                        <Edit size={14} />
                      </Link>
                      <button onClick={() => handleDelete(flow.id, flow.name)} title="Delete" className="p-1.5 rounded hover:bg-red-900 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
