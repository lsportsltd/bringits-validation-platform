'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CommandForm } from '@/components/CommandForm';

export default function NewCommandPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/commands" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Command</h1>
          <p className="text-gray-400 text-sm mt-0.5">Create a reusable validation command template</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <CommandForm />
      </div>
    </div>
  );
}
