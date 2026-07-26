import React from 'react';
import { Minus, Square, X, Terminal } from 'lucide-react';

export default function TitleBar() {
  const handleMinimize = () => window.api?.window.minimize();
  const handleMaximize = () => window.api?.window.maximize();
  const handleClose = () => window.api?.window.close();
  const handleDevTools = () => window.api?.window.toggleDevTools();

  return (
    <div className="titlebar-drag h-10 bg-surface-950 border-b border-surface-800 flex items-center justify-between px-4 select-none">
      {/* App Title */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">SX</span>
        </div>
        <span className="text-sm font-semibold text-surface-300">SideloadX</span>
      </div>

      {/* Window Controls */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={handleDevTools}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
          title="Dev Tools"
        >
          <Terminal size={14} />
        </button>
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger text-surface-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
