'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Play, Trash2, Terminal } from 'lucide-react';
import { api } from '@/lib/api';
import { TypeBadge } from '@/components/TypeBadge';
import type { CommandTemplate } from '@/lib/types';

export default function CommandsPage() {
  const [commands, setCommands] = useState<CommandTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.commands.list().then((data) => setCommands(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete command "${name}"?`)) return;
    await api.commands.delete(id);
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Terminal size={22} className="text-violet-400" /> Commands
          </h1>
          <p className="text-gray-400 text-sm mt-1">Reusable validation command templates</p>
        </div>
        <Link
          href="/commands/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Command
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : commands.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-gray-800 rounded-lg">
          <Terminal size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-400 mb-4">No commands yet</p>
          <Link href="/commands/new" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-500">
            Create first command
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tags</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Updated</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((cmd) => (
                <tr key={cmd.id} className="border-b border-gray-800 hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-white">{cmd.name}</div>
                    {cmd.description && <div className="text-xs text-gray-500 mt-0.5">{cmd.description}</div>}
                  </td>
                  <td className="px-4 py-3"><TypeBadge type={cmd.type} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{cmd.action}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(cmd.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(cmd.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Link href={`/commands/${cmd.id}/run`} title="Run" className="p-1.5 rounded hover:bg-emerald-900 text-gray-400 hover:text-emerald-300 transition-colors">
                        <Play size={14} />
                      </Link>
                      <Link href={`/commands/${cmd.id}/edit`} title="Edit" className="p-1.5 rounded hover:bg-blue-900 text-gray-400 hover:text-blue-300 transition-colors">
                        <Edit size={14} />
                      </Link>
                      <button onClick={() => handleDelete(cmd.id, cmd.name)} title="Delete" className="p-1.5 rounded hover:bg-red-900 text-gray-400 hover:text-red-400 transition-colors">
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
