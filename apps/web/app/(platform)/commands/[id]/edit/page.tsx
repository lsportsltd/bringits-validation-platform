'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { CommandForm } from '@/components/CommandForm';
import type { CommandTemplate } from '@/lib/types';

export default function EditCommandPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [command, setCommand] = useState<CommandTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.commands.get(params.id).then(setCommand).finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/commands" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Command</h1>
          {command && <p className="text-gray-400 text-sm mt-0.5 font-mono">{command.name}</p>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : command ? (
          <CommandForm initial={command} />
        ) : (
          <div className="text-red-400 text-sm">Command not found</div>
        )}
      </div>
    </div>
  );
}
