import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react';

export default function SourcesPage({ showToast }) {
  const [sources, setSources] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', url: '' });

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    if (!window.api) return;
    const data = await window.api.sources.getAll();
    setSources(data || []);
  }

  async function handleAddSource() {
    if (!window.api) return;
    if (!newSource.name || !newSource.url) {
      showToast('Please enter both name and URL', 'error');
      return;
    }

    const result = await window.api.sources.add(newSource.name, newSource.url);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Source added', 'success');
      setShowAddModal(false);
      setNewSource({ name: '', url: '' });
      loadSources();
    }
  }

  async function handleRemove(id) {
    if (!window.api) return;
    await window.api.sources.remove(id);
    showToast('Source removed', 'success');
    loadSources();
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sources</h1>
          <p className="text-sm text-surface-400 mt-1">
            App sources and feeds for discovering new apps
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
          <Plus size={16} /> Add Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <Globe size={40} className="text-surface-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-1">No sources configured</h3>
          <p className="text-sm text-surface-500">Add sources to browse and download apps</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sources.map((source, index) => (
            <motion.div
              key={source.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card flex items-center gap-4"
            >
              <Globe size={24} className="text-accent" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{source.name}</h3>
                <p className="text-xs text-surface-400 truncate">{source.url}</p>
                {source.last_fetched && (
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    Last fetched: {new Date(source.last_fetched).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-success' : 'bg-surface-500'}`} />
                <button onClick={() => handleRemove(source.id)} className="btn-ghost text-xs py-1 px-2 text-danger">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-96 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Add Source</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-surface-300 mb-1 block">Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="My Source"
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm text-surface-300 mb-1 block">URL</label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://example.com/source.json"
                  className="input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleAddSource} className="btn-primary flex-1 justify-center">
                  <Plus size={16} /> Add
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setNewSource({ name: '', url: '' }); }}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
