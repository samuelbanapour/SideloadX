import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

export default function DevicesPage({ showToast }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadDevices() {
    if (!window.api) return;
    setLoading(true);
    const data = await window.api.devices.list();
    setDevices(data || []);
    setLoading(false);
  }

  async function handleInstall(device, appBundleId) {
    if (!window.api) return;
    const result = await window.api.devices.uninstall(device.udid, appBundleId);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast('App uninstalled', 'success');
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-sm text-surface-400 mt-1">
            {devices.length} device{devices.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <button onClick={loadDevices} className="btn-ghost text-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
            <Smartphone size={40} className="text-surface-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-1">No devices connected</h3>
          <p className="text-sm text-surface-500">Connect an iPhone or iPad via USB</p>
          <p className="text-xs text-surface-600 mt-2">Requires libimobiledevice to be installed</p>
          <code className="text-xs text-surface-500 mt-1 bg-surface-800 px-3 py-1 rounded">brew install libimobiledevice</code>
        </div>
      ) : (
        <div className="grid gap-4">
          {devices.map((device, index) => (
            <motion.div
              key={device.udid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card flex items-center gap-6"
            >
              {/* Device Icon */}
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center">
                <Smartphone size={32} className="text-accent" />
              </div>

              {/* Device Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">{device.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                  <span>{device.model || device.product_type}</span>
                  <span className="w-1 h-1 rounded-full bg-surface-600" />
                  <span>iOS {device.os_version}</span>
                  <span className="w-1 h-1 rounded-full bg-surface-600" />
                  <span className="font-mono text-[10px]">{device.udid?.slice(0, 20)}...</span>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <Wifi size={14} className="text-success" />
                <span className="text-xs text-success">USB</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
