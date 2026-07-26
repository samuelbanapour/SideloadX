import React from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, Trash2, Pin, PinOff, Smartphone } from 'lucide-react';
import clsx from 'clsx';

const statusColors = {
  uploaded: 'bg-surface-600 text-surface-300',
  signing: 'bg-accent/20 text-accent',
  signed: 'bg-success/20 text-success',
  installed: 'bg-success/20 text-success',
  expired: 'bg-danger/20 text-danger',
  evicted: 'bg-surface-600 text-surface-400',
};

const statusLabels = {
  uploaded: 'Ready',
  signing: 'Signing...',
  signed: 'Signed',
  installed: 'Installed',
  expired: 'Expired',
  evicted: 'Evicted',
};

export default function AppCard({ app, onSign, onInstall, onRemove, onPin, onSelect }) {
  const daysLeft = app.expires_at
    ? Math.max(0, Math.ceil((new Date(app.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <motion.div
      className="app-card"
      whileHover={{ y: -2 }}
      onClick={() => onSelect?.(app)}
    >
      {/* App Icon */}
      <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center overflow-hidden">
        {app.icon_path ? (
          <img
            src={`file://${app.icon_path}`}
            alt={app.display_name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span className="text-2xl font-bold text-accent">
            {(app.display_name || app.original_name || '?')[0]?.toUpperCase()}
          </span>
        )}
      </div>

      {/* App Info */}
      <div className="text-center w-full">
        <h3 className="text-sm font-semibold text-white truncate">
          {app.display_name || app.original_name}
        </h3>
        <p className="text-[11px] text-surface-400 truncate">{app.bundle_id}</p>
        <p className="text-[11px] text-surface-500">v{app.version}</p>
      </div>

      {/* Status Badge */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <span className={clsx('badge', statusColors[app.status] || 'bg-surface-600 text-surface-300')}>
          {statusLabels[app.status] || app.status}
        </span>

        {/* Expiry */}
        {daysLeft !== null && app.status !== 'uploaded' && (
          <span className={clsx(
            'text-[11px] font-medium',
            daysLeft <= 1 ? 'text-danger' :
            daysLeft <= 3 ? 'text-warning' :
            'text-surface-400'
          )}>
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </span>
        )}

        {/* Pinned badge */}
        {app.pinned ? (
          <span className="text-[10px] text-accent flex items-center gap-0.5">
            <Pin size={10} /> Pinned
          </span>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 w-full mt-1" onClick={(e) => e.stopPropagation()}>
        {(app.status === 'uploaded' || app.status === 'expired') && (
          <button onClick={() => onSign?.(app)} className="btn-primary text-xs py-1.5 flex-1 justify-center">
            <RefreshCw size={12} /> Sign
          </button>
        )}
        {(app.status === 'signed' || app.status === 'installed') && (
          <button onClick={() => onInstall?.(app)} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
            <Smartphone size={12} /> Install
          </button>
        )}
        <button
          onClick={() => onPin?.(app)}
          className={clsx('btn-ghost text-xs py-1.5 px-2', app.pinned && 'text-accent')}
          title={app.pinned ? 'Unpin' : 'Pin (prevent auto-eviction)'}
        >
          {app.pinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={() => onRemove?.(app)}
          className="btn-ghost text-xs py-1.5 px-2 text-danger hover:text-danger"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}
