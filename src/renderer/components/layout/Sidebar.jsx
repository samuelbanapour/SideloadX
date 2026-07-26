import React from 'react';
import { Library, Smartphone, KeyRound, Users, Globe, Settings } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { id: 'library', label: 'Library', icon: Icons.Library },
  { id: 'devices', label: 'Devices', icon: Icons.Smartphone },
  { id: 'certificates', label: 'Certificates', icon: Icons.KeyRound },
  { id: 'accounts', label: 'Accounts', icon: Icons.Users },
  { id: 'sources', label: 'Sources', icon: Icons.Globe },
  { id: 'settings', label: 'Settings', icon: Icons.Settings },
];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <nav className="w-56 bg-surface-900/30 border-r border-surface-800 p-3 flex flex-col gap-1">
      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer text-left w-full',
                isActive
                  ? 'text-white bg-surface-800 shadow-sm'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              )}
            >
              <Icon size={18} className={isActive ? 'text-accent' : ''} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Version */}
      <div className="pt-3 border-t border-surface-800">
        <p className="text-[11px] text-surface-500 px-3">v1.0.0</p>
      </div>
    </nav>
  );
}
