'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { JsonEditor } from './JsonEditor';
import { TypeBadge } from './TypeBadge';
import type { CommandTemplate, CommandType } from '@/lib/types';

interface Props {
  initial?: Partial<CommandTemplate>;
  onSave?: (data: CommandTemplate) => void;
}

const DEFAULT_CONFIGS: Record<string, Record<string, any>> = {
  http: { url: 'https://example.com/api', headers: {}, body: {} },
  redis: { connection: 'default_redis', keyPattern: '*', key: '' },
  postgres: { connection: 'default_db', query: 'SELECT 1' },
  kafka: { topic: 'my-topic', consumerGroup: 'my-group' },
  kubernetes: { namespace: 'default', deployment: 'my-service' },
  storage: { bucket: 'my-bucket', path: 'files/example.json' },
  logs: { provider: 'mock', query: { service: 'my-service' } },
};

const DEFAULT_EXPECTS: Record<string, Record<string, any>> = {
  http: { statusCode: 200 },
  redis: { minKeys: 1 },
  postgres: { rows: 1 },
  kafka: {},
  kubernetes: { minReadyReplicas: 1 },
  storage: {},
  logs: { minResults: 1 },
};

export function CommandForm({ initial, onSave }: Props) {
  const router = useRouter();
  const [commandTypes, setCommandTypes] = useState<CommandType[]>([]);
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [type, setType] = useState(initial?.type || 'http');
  const [action, setAction] = useState(initial?.action || 'get');
  const [timeoutSeconds, setTimeoutSeconds] = useState(initial?.timeoutSeconds || 30);
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [config, setConfig] = useState<any>(initial?.config || DEFAULT_CONFIGS['http']);
  const [expect, setExpect] = useState<any>(initial?.expect || DEFAULT_EXPECTS['http']);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.meta.commandTypes().then(setCommandTypes).catch(console.error);
  }, []);

  const availableActions = commandTypes.find((t) => t.type === type)?.actions || [];

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const actions = commandTypes.find((t) => t.type === newType)?.actions || [];
    setAction(actions[0] || '');
    if (!initial) {
      setConfig(DEFAULT_CONFIGS[newType] || {});
      setExpect(DEFAULT_EXPECTS[newType] || {});
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        type,
        action,
        timeoutSeconds,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        config,
        expect,
      };

      let result: CommandTemplate;
      if (initial?.id) {
        result = await api.commands.update(initial.id, payload);
      } else {
        result = await api.commands.create(payload);
      }
      onSave?.(result);
      router.push('/commands');
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.commands.runInline({ name, type, action, timeoutSeconds, config, expect });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ status: 'failed', errorMessage: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="create_proxy"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this command validates"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Type *</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {commandTypes.map((t) => (
              <option key={t.type} value={t.type}>{t.type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Action *</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {availableActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Timeout (sec)</label>
          <input
            type="number"
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="proxy, http, crud"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <JsonEditor label="Config" value={config} onChange={setConfig} height="h-64" />
        <JsonEditor label="Expect" value={expect} onChange={setExpect} height="h-64" />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Save size={15} /> {saving ? 'Saving...' : 'Save Command'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Play size={15} /> {testing ? 'Running...' : 'Test Run'}
        </button>
      </div>

      {testResult && (
        <div className={`p-4 rounded-lg border ${testResult.status === 'passed' ? 'border-emerald-700 bg-emerald-950' : 'border-red-700 bg-red-950'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-semibold ${testResult.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.status?.toUpperCase()}
            </span>
            {testResult.durationMs !== undefined && (
              <span className="text-xs text-gray-400">{testResult.durationMs}ms</span>
            )}
          </div>
          {testResult.errorMessage && (
            <p className="text-red-300 text-sm mb-2">{testResult.errorMessage}</p>
          )}
          {testResult.evidence && (
            <pre className="text-xs font-mono text-gray-300 overflow-auto max-h-40">
              {JSON.stringify(testResult.evidence, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
