import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, AlertCircle, CheckCircle, Shield, Smartphone } from 'lucide-react';
import clsx from 'clsx';

export default function AccountsPage({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [capacity, setCapacity] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccount, setNewAccount] = useState({ appleId: '', password: '', type: 'free' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!window.api) return;
    const accs = await window.api.accounts.getAll();
    const cap = await window.api.accounts.getCapacity();
    setAccounts(accs || []);
    setCapacity(cap);
  }

  async function handleAddAccount() {
    if (!window.api) return;
    if (!newAccount.appleId) {
      showToast('Please enter an Apple ID', 'error');
      return;
    }

    const result = await window.api.accounts.add(newAccount.appleId, newAccount.password, newAccount.type);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Account added: ${newAccount.appleId}`, 'success');
      setShowAddModal(false);
      setNewAccount({ appleId: '', password: '', type: 'free' });
      loadData();
    }
  }

  async function handleRemoveAccount(id) {
    if (!window.api) return;
    await window.api.accounts.remove(id);
    showToast('Account removed', 'success');
    loadData();
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage Apple IDs and bypass free developer limits
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
          <Plus size={16} /> Add Apple ID
        </button>
      </div>

      {/* Capacity Dashboard */}
      {capacity && capacity.accounts > 0 && (
        <div className="card border-accent/20 bg-accent/5">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-accent" />
            <div>
              <h2 className="text-base font-semibold text-white">Capacity Overview</h2>
              <p className="text-xs text-surface-400">
                Total: {capacity.total_apps}/{capacity.total_max_apps} app slots · {capacity.total_devices}/{capacity.total_max_devices} device slots
                <span className="ml-2 text-surface-500">across {capacity.accounts} account{capacity.accounts !== 1 ? 's' : ''}</span>
              </p>
            </div>
          </div>

          {/* Global Progress Bar */}
          <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (capacity.total_apps / capacity.total_max_apps) * 100)}%` }}
              className={`h-full rounded-full ${
                capacity.total_apps >= capacity.total_max_apps ? 'bg-warning' : 'bg-success'
              }`}
            />
          </div>
        </div>
      )}

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <Users size={40} className="text-surface-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-1">No accounts yet</h3>
          <p className="text-sm text-surface-500">
            Add Apple IDs to increase your app signing capacity
          </p>
          <p className="text-xs text-surface-600 mt-2">
            Each free Apple ID gives you 3 apps + 10 devices. Add multiple to bypass limits.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={clsx(
                'card relative overflow-hidden',
                account.is_active ? '' : 'opacity-50'
              )}
            >
              {/* Account Type Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={clsx(
                  'badge text-[10px]',
                  account.account_type === 'free' && 'badge-info',
                  account.account_type === 'paid' && 'badge-success',
                  account.account_type === 'enterprise' && 'badge-warning'
                )}>
                  {account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}
                </span>
                {account.current_apps >= account.max_apps ? (
                  <div className="flex items-center gap-1 text-danger text-xs">
                    <AlertCircle size={12} />
                    <span>Full</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-success text-xs">
                    <CheckCircle size={12} />
                    <span>Open</span>
                  </div>
                )}
              </div>

              {/* Apple ID */}
              <h3 className="text-base font-semibold text-white mb-1">
                {account.display_name || account.apple_id.split('@')[0]}
              </h3>
              <p className="text-xs text-surface-500 mb-4">{account.apple_id}</p>

              {/* Capacity Bars */}
              <div className="space-y-3">
                {/* App Slots */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-300">
                      <Smartphone size={12} className="inline mr-1" />
                      App Slots
                    </span>
                    <span className="text-surface-400 font-mono">
                      {account.current_apps}/{account.max_apps}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(account.current_apps / account.max_apps) * 100}%` }}
                      className={clsx(
                        'h-full rounded-full',
                        account.current_apps >= account.max_apps ? 'bg-warning' : 'bg-accent'
                      )}
                    />
                  </div>
                </div>

                {/* Device Slots */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-300">
                      <Smartphone size={12} className="inline mr-1" />
                      Device Slots
                    </span>
                    <span className="text-surface-400 font-mono">
                      {account.current_devices}/{account.max_devices}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(account.current_devices / account.max_devices) * 100}%` }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-surface-800 flex justify-end">
                <button
                  onClick={() => handleRemoveAccount(account.id)}
                  className="btn-ghost text-xs py-1 px-2 text-danger hover:text-danger"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
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
            <h3 className="text-lg font-semibold text-white mb-4">Add Apple ID</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-surface-300 mb-1 block">Apple ID Email</label>
                <input
                  type="email"
                  value={newAccount.appleId}
                  onChange={(e) => setNewAccount({ ...newAccount, appleId: e.target.value })}
                  placeholder="example@icloud.com"
                  className="input"
                />
              </div>

              <div>
                <label className="text-sm text-surface-300 mb-1 block">Password</label>
                <input
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder="App-specific password recommended"
                  className="input"
                />
                <p className="text-[10px] text-surface-500 mt-1">
                  Stored locally. Use an app-specific password for security.
                </p>
              </div>

              <div>
                <label className="text-sm text-surface-300 mb-1 block">Account Type</label>
                <select
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                  className="input"
                >
                  <option value="free">Free (3 apps, 10 devices, 7-day expiry)</option>
                  <option value="paid">Paid Developer (unlimited apps, 100 devices, 1-year)</option>
                  <option value="enterprise">Enterprise (unlimited apps/devices)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleAddAccount} className="btn-primary flex-1 justify-center">
                  <Plus size={16} /> Add Account
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setNewAccount({ appleId: '', password: '', type: 'free' }); }}
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
