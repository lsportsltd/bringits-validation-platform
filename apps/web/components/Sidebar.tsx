'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Terminal,
  GitBranch,
  History,
  Zap,
  MessageSquare,
  Plug,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/connections', label: 'Connections', icon: Plug },
  { href: '/commands', label: 'Commands', icon: Terminal },
  { href: '/flows', label: 'Flows', icon: GitBranch },
  { href: '/runs', label: 'Run History', icon: History },
  { href: '/chat', label: 'AI Flow Builder', icon: MessageSquare },
];

export function Sidebar() {
  const path = usePathname();

  const isActive = (href: string) => path === href || path.startsWith(href + '/');

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-violet-600">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Bringits</div>
            <div className="text-xs text-gray-400">Validation Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive(href)
                ? 'bg-violet-600 text-white'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <div className="text-xs text-gray-600 text-center">Command-Based Validation</div>
      </div>
    </aside>
  );
}
