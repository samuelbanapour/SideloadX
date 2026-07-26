import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Plus, Trash2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const typeBadges = {
  free: { label: 'Free', class: 'badge-info' },
  paid: { label: 'Paid', class: 'badge-success' },
  enterprise: { label: 'Enterprise', class: 'badge-warning' },
  keychain: { label: 'Keychain', class: 'badge bg-surface-600 text-surface-300' },
};

export default function CertificatesPage({ showToast }) {
  const [certs, setCerts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [p12Path, setP12Path] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadCerts();
  }, []);

  async function loadCerts() {
    if (!window.api) return;
    const data = await window.api.certs.getAll();
    setCerts(data || []);
  }

  async function handleAdd() {
    if (!window.api) return;

    if (!p12Path) {
      const path = await window.api.certs.pickFile();
      if (!path) return;
      setP12Path(path);
      return;
    }

    const result = await window.api.certs.add(p12Path, password);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Certificate added successfully', 'success');
      setShowAddModal(false);
      setP12Path('');
      setPassword('');
      loadCerts();
    }
  }

  async function handleRemove(cert) {
    if (!window.api) return;
    await window.api.certs.remove(cert.id);
    showToast('Certificate removed', 'success');
    loadCerts();
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Certificates</h1>
          <p className="text-sm text-surface-400 mt-1">
            {certs.length} certificate{certs.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
          <Plus size={16} /> Add Certificate
        </button>
      </div>

      {certs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <KeyRound size={40} className="text-surface-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-1">No certificates</h3>
          <p className="text-sm text-surface-500">
            Add a .p12 certificate or use system keychain certificates
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {certs.map((cert, index) => {
            const badge = typeBadges[cert.type] || typeBadges.free;
            return (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card flex items-center gap-4"
              >
                <KeyRound size={24} className="text-accent" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{cert.name}</h3>
                    <span className={badge.class}>{badge.label}</span>
                    {cert.is_active ? null : (
                      <span className="badge bg-danger/20 text-danger text-[10px]">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                    <span>Team: {cert.team_id || 'N/A'}</span>
                    {cert.expires_at && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-surface-600" />
                        <span>Expires: {new Date(cert.expires_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(cert)}
                  className="btn-ghost text-xs py-1.5 px-2 text-danger hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Certificate Modal */}
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
            <h3 className="text-lg font-semibold text-white mb-4">Add Certificate</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-surface-300 mb-1 block">.p12 File</label>
                <div
                  onClick={() => handleAdd()}
                  className="input cursor-pointer flex items-center justify-between"
                >
                  <span className={p12Path ? 'text-white' : 'text-surface-500'}>
                    {p12Path ? p12Path.split('/').pop() : 'Click to select .p12 file'}
                  </span>
                  <KeyRound size={16} className="text-surface-400" />
                </div>
              </div>

              {p12Path && (
                <div>
                  <label className="text-sm text-surface-300 mb-1 block">Password (optional)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=".p12 password"
                    className="input"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleAdd} className="btn-primary flex-1 justify-center" disabled={!p12Path}>
                  <Plus size={16} /> Add
                </button>
                <button onClick={() => { setShowAddModal(false); setP12Path(''); setPassword(''); }} className="btn-secondary flex-1 justify-center">
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
