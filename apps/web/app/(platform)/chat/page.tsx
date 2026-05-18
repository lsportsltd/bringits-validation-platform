'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Send, Loader2, Play, ChevronRight, Zap, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  flow?: any;
  loading?: boolean;
}

const SUGGESTIONS = [
  'Build a flow that health-checks link-api and creates a tenant',
  'Build a flow that checks consumer lag on a Kafka CDC topic',
  'Create a flow that reads proxy targets from Redis link cluster',
  'Build a full target CRUD flow with Postgres cleanup',
  'Create a flow that lists all providers and creates a new one',
];

function CommandRow({ cmd, index }: { cmd: any; index: number }) {
  const typeColors: Record<string, string> = {
    http: 'text-blue-400',
    postgres: 'text-amber-400',
    redis: 'text-red-400',
    kafka: 'text-purple-400',
  };

  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs border-b border-gray-800/50 last:border-0">
      <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 font-mono text-[10px] flex-shrink-0">
        {index + 1}
      </span>
      <span className="font-mono text-gray-300 flex-1 min-w-0 truncate">{cmd.name}</span>
      <span className={`font-mono flex-shrink-0 ${typeColors[cmd.type] || 'text-gray-400'}`}>{cmd.type}</span>
      <ChevronRight size={9} className="text-gray-700 flex-shrink-0" />
      <span className="text-gray-500 flex-shrink-0">{cmd.action}</span>
    </div>
  );
}

function FlowPreview({ flow, onSave, saving }: { flow: any; onSave: (flow: any) => void; saving: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/8 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-300 truncate">{flow.name}</span>
          <span className="text-xs text-gray-600 flex-shrink-0">{flow.commands?.length} steps · {flow.env}</span>
        </div>
        <button
          onClick={() => onSave(flow)}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
          {saving ? 'Saving...' : 'Save & Edit'}
        </button>
      </div>
      <div className="px-4 py-2">
        {flow.commands?.map((cmd: any, i: number) => (
          <CommandRow key={i} cmd={cmd} index={i} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, onSave, saving }: { msg: Message; onSave: (f: any) => void; saving: boolean }) {
  const isUser = msg.role === 'user';

  if (msg.loading) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={13} className="text-gray-400" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-800/80 text-gray-400 text-sm">
          <Loader2 size={12} className="animate-spin" />
          <span>Building flow...</span>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[75%]">
          <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-sm leading-relaxed">
            {msg.content}
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-700 border border-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={13} className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={13} className="text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-800/80 text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
        {msg.flow && <FlowPreview flow={msg.flow} onSave={onSave} saving={saving} />}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I can build validation flows from plain English descriptions. Tell me what you want to test — an API endpoint, a Redis key, a Kafka topic lag, or a multi-step CRUD flow.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const send = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);
    setLoading(true);

    try {
      const history = [
        ...messages
          .filter((m) => !m.loading)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userText },
      ];

      const res = await api.chat.send(history);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: res.message, flow: res.flow ?? undefined },
      ]);
    } catch (err: any) {
      const msg = err.message?.includes('fetch')
        ? 'Could not reach the backend. Make sure the API is running on port 3002.'
        : `Error: ${err.message}`;
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const saveFlow = useCallback(async (flow: any) => {
    if (saving) return;
    setSaving(true);
    try {
      const created = await api.flows.create({
        name: flow.name,
        description: flow.description || '',
        env: flow.env || 'dev',
        variables: flow.variables || {},
        tags: ['ai-generated'],
      });
      for (const cmd of flow.commands ?? []) {
        await api.flows.addCommand(created.id, cmd);
      }
      router.push(`/flows/${created.id}/edit`);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
      setSaving(false);
    }
  }, [saving, router]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showSuggestions = messages.length === 1;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800/60 bg-gray-950">
        <div className="p-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
          <Zap size={14} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">AI Flow Builder</h1>
          <p className="text-xs text-gray-500">Describe what to validate — AI builds the flow</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-400">Ollama · llama3</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onSave={saveFlow} saving={saving} />
        ))}

        {showSuggestions && (
          <div className="pl-10 space-y-2 pt-2">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Try asking</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="block w-full text-left px-4 py-2.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/50 hover:bg-gray-800/50 text-sm text-gray-400 hover:text-gray-200 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800/60 bg-gray-950">
        <div className="flex items-end gap-3 bg-gray-900 border border-gray-700/60 rounded-2xl px-4 py-3 focus-within:border-gray-600 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe a flow... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none outline-none overflow-hidden"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 flex items-center justify-center transition-colors"
          >
            {loading
              ? <Loader2 size={13} className="animate-spin text-white" />
              : <Send size={13} className="text-white" />
            }
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-2 text-center">
          Powered by Ollama locally · set OPENAI_API_KEY or GROQ_API_KEY in .env for cloud AI
        </p>
      </div>
    </div>
  );
}
