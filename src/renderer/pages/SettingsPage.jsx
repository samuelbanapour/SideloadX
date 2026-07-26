import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Server, Palette, Info, ExternalLink, Shield } from 'lucide-react';

export default function SettingsPage({ showToast }) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [serverPort, setServerPort] = useState(8443);
  const [devicePolling, setDevicePolling] = useState(5000);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    if (!window.api) return;
    const ar = await window.api.settings.get('auto_refresh');
    if (ar !== null) setAutoRefresh(ar === 'true');

    const port = await window.api.settings.get('server_port');
    if (port !== null) setServerPort(parseInt(port));

    const dp = await window.api.settings.get('device_polling');
    if (dp !== null) setDevicePolling(parseInt(dp));
  }

  async function saveSetting(key, value) {
    if (!window.api) return;
    await window.api.settings.set(key, value);
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-surface-400 mt-1">Configure SideloadX</p>
      </div>

      {/* General */}
      <section className="card">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={20} className="text-accent" />
          <h2 className="text-base font-semibold text-white">General</h2>
        </div>

        <div className="space-y-4">
          {/* Auto Refresh */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Auto-Refresh</p>
              <p className="text-xs text-surface-400">
                Automatically re-sign apps before they expire
              </p>
            </div>
            <button
              onClick={async () => {
                const next = !autoRefresh;
                setAutoRefresh(next);
                await saveSetting('auto_refresh', String(next));
                showToast(next ? 'Auto-refresh enabled' : 'Auto-refresh disabled', 'success');
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoRefresh ? 'bg-accent' : 'bg-surface-600'
              }`}
            >
              <motion.div
                animate={{ x: autoRefresh ? 24 : 2 }}
                className="w-5 h-5 bg-white rounded-full shadow-sm mt-[2px] ml-[2px]"
              />
            </button>
          </div>
        </div>
      </section>

      {/* Server */}
      <section className="card">
        <div className="flex items-center gap-3 mb-4">
          <Server size={20} className="text-accent" />
          <h2 className="text-base font-semibold text-white">HTTPS Server</h2>
        </div>
        <p className="text-xs text-surface-400 mb-3">
          Used for OTA installation via itms-services:// links
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-surface-300 mb-1 block">Server Port</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={serverPort}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 8443;
                  setServerPort(val);
                  saveSetting('server_port', String(val));
                }}
                className="input w-32"
              />
              <span className="text-xs text-surface-500 self-center">
                Default: 8443
              </span>
            </div>
          </div>
          <p className="text-[10px] text-surface-500">
            Apps can be installed via: <code className="text-accent">itms-services://?action=download-manifest&url=https://YOUR_IP:{serverPort}/manifest/APP_ID</code>
          </p>
        </div>
      </section>

      {/* Device */}
      <section className="card">
        <div className="flex items-center gap-3 mb-4">
          <ExternalLink size={20} className="text-accent" />
          <h2 className="text-base font-semibold text-white">Device</h2>
        </div>
        <div>
          <label className="text-xs text-surface-300 mb-1 block">Polling Interval (ms)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={devicePolling}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 5000;
                setDevicePolling(val);
                saveSetting('device_polling', String(val));
              }}
              className="input w-32"
            />
            <span className="text-xs text-surface-500 self-center">
              How often to check for connected devices
            </span>
          </div>
        </div>
      </section>

      {/* Security Info */}
      <section className="card border-warning/20 bg-warning/5">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-warning mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-warning mb-1">Security Note</h2>
            <p className="text-xs text-surface-400">
              Apple ID passwords are stored locally in the SQLite database. We recommend using
              <strong> app-specific passwords</strong> generated from your Apple ID account page.
              Passwords are never sent to any server other than Apple's authentication services.
            </p>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="card">
        <div className="flex items-center gap-3 mb-4">
          <Info size={20} className="text-accent" />
          <h2 className="text-base font-semibold text-white">About</h2>
        </div>
        <div className="text-sm text-surface-400 space-y-1">
          <p>SideloadX v1.0.0</p>
          <p>An all-in-one iOS app sideloading tool</p>
          <p className="text-xs text-surface-500 mt-2">
            Built with Electron, React, and TailwindCSS
          </p>
        </div>
      </section>
    </div>
  );
}
