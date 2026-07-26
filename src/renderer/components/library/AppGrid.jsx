import React from 'react';
import { motion } from 'framer-motion';
import AppCard from './AppCard';

export default function AppGrid({ apps, onSign, onInstall, onRemove, onPin, onSelect }) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
          <span className="text-3xl">📱</span>
        </div>
        <h3 className="text-lg font-semibold text-surface-300 mb-1">No apps yet</h3>
        <p className="text-sm text-surface-500">Drag & drop an IPA file above to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {apps.map((app, index) => (
        <motion.div
          key={app.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
        >
          <AppCard
            app={app}
            onSign={onSign}
            onInstall={onInstall}
            onRemove={onRemove}
            onPin={onPin}
            onSelect={onSelect}
          />
        </motion.div>
      ))}
    </div>
  );
}
