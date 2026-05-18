'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { JsonEditor } from '@/components/JsonEditor';

export default function NewFlowPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [env, setEnv] = useState('qa');
  const [tags, setTags] = useState('');
  const [variables, setVariables] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { alert('Name is required'); return; }
    setSaving(true);
    try {
      const flow = await api.flows.create({
        name: name.trim(),
        description: description.trim() || undefined,
        env,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        variables,
      });
      router.push(`/flows/${flow.id}/edit`);
    } catch (err: any) {
      alert('Failed: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/flows" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Flow</h1>
          <p className="text-gray-400 text-sm mt-0.5">Create a new validation flow</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="proxy-crud-validation"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this flow validate?"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Environment</label>
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {['dev', 'qa', 'prod', 'local'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="proxy, crud, e2e"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <JsonEditor
          label="Variables"
          value={variables}
          onChange={setVariables}
          height="h-40"
          placeholder='{ "proxy_id": "proxy-test-{{run_id}}", "host": "1.2.3.4" }'
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          <Save size={15} /> {saving ? 'Creating...' : 'Create Flow'}
        </button>
      </div>
    </div>
  );
}
