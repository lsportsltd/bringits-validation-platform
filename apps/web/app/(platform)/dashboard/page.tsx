'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Terminal, GitBranch, History, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { TypeBadge } from '@/components/TypeBadge';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    Promise.all([api.commands.list(), api.flows.list(), api.runs.list()])
      .then(([commands, flows, runs]) => setData({ commands, flows, runs }))
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        requestAnimationFrame(() => setVisible(true));
      });
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  const { commands = [], flows = [], runs = { flowRuns: [], commandRuns: [] } } = data || {};
  const allFlowRuns = runs.flowRuns || [];
  const passed = allFlowRuns.filter((r: any) => r.status === 'passed').length;
  const failed = allFlowRuns.filter((r: any) => r.status === 'failed').length;

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-item {
          animation: slideInLeft 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .dash-up {
          animation: slideInUp 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="dash-item" style={{ animationDelay: '0ms' }}>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">Command-Based Validation Platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Terminal size={20} />, label: 'Commands', value: commands.length, href: '/commands', color: 'violet' },
            { icon: <GitBranch size={20} />, label: 'Flows', value: flows.length, href: '/flows', color: 'blue' },
            { icon: <CheckCircle size={20} />, label: 'Runs Passed', value: passed, href: '/runs', color: 'emerald' },
            { icon: <XCircle size={20} />, label: 'Runs Failed', value: failed, href: '/runs', color: 'red' },
          ].map((s, i) => (
            <div key={s.label} className="dash-item" style={{ animationDelay: `${80 + i * 60}ms` }}>
              <StatCard {...s} />
            </div>
          ))}
        </div>

        {/* Recent Flows */}
        <div>
          <div className="flex items-center justify-between mb-3 dash-item" style={{ animationDelay: '320ms' }}>
            <h2 className="text-lg font-semibold text-white">Recent Flow Runs</h2>
            <Link href="/runs" className="text-sm text-violet-400 hover:text-violet-300">View all →</Link>
          </div>
          {allFlowRuns.length === 0 ? (
            <EmptyState message="No flow runs yet. Run a flow to see results here." />
          ) : (
            <div className="space-y-2">
              {allFlowRuns.slice(0, 5).map((run: any, i: number) => (
                <div key={run.id} className="dash-item" style={{ animationDelay: `${360 + i * 55}ms` }}>
                  <Link
                    href={`/runs/${run.id}`}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <StatusBadge status={run.status} />
                    <span className="font-medium text-sm text-white flex-1">{run.flowName}</span>
                    <span className="text-xs text-gray-400 font-mono">{run.correlationId}</span>
                    {run.durationMs && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={11} /> {run.durationMs}ms
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{new Date(run.startedAt).toLocaleString()}</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { href: '/commands/new', title: 'New Command', description: 'Create a new validation command', icon: <Terminal size={20} /> },
            { href: '/flows/new', title: 'New Flow', description: 'Build a multi-step validation flow', icon: <GitBranch size={20} /> },
            { href: '/runs', title: 'Run History', description: 'View past runs and evidence', icon: <History size={20} /> },
          ].map((q, i) => (
            <div key={q.href} className="dash-up" style={{ animationDelay: `${600 + i * 60}ms` }}>
              <QuickLink {...q} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, label, value, href, color }: any) {
  const colorMap: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-950',
    blue: 'text-blue-400 bg-blue-950',
    emerald: 'text-emerald-400 bg-emerald-950',
    red: 'text-red-400 bg-red-950',
  };

  return (
    <Link href={href} className="block w-full p-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]}`}>
        <span className={colorMap[color].split(' ')[0]}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-0.5">{label}</div>
    </Link>
  );
}

function QuickLink({ href, title, description, icon }: any) {
  return (
    <Link href={href} className="flex items-start gap-3 p-4 w-full rounded-lg bg-gray-900 border border-gray-800 hover:border-violet-700 hover:bg-gray-800 transition-colors group">
      <div className="p-2 rounded-lg bg-gray-800 group-hover:bg-violet-900 transition-colors text-gray-400 group-hover:text-violet-300">
        {icon}
      </div>
      <div>
        <div className="font-medium text-white text-sm">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg">
      {message}
    </div>
  );
}
