'use client';

const TYPE_COLORS: Record<string, string> = {
  http: 'bg-violet-100 text-violet-800',
  redis: 'bg-red-100 text-red-800',
  postgres: 'bg-blue-100 text-blue-800',
  kafka: 'bg-orange-100 text-orange-800',
  kubernetes: 'bg-cyan-100 text-cyan-800',
  storage: 'bg-yellow-100 text-yellow-800',
  logs: 'bg-green-100 text-green-800',
};

export function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${cls}`}>
      {type}
    </span>
  );
}
