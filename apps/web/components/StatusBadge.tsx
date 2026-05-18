'use client';

interface Props {
  status: 'passed' | 'failed' | 'running' | 'skipped' | string;
  size?: 'sm' | 'md';
}

const CONFIG = {
  passed: { label: 'Passed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-800 border-red-200' },
  running: { label: 'Running', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  skipped: { label: 'Skipped', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const cfg = CONFIG[status as keyof typeof CONFIG] || { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full border ${cfg.cls} ${sizeClass}`}>
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}
      {cfg.label}
    </span>
  );
}
