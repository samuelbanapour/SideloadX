import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Shield } from 'lucide-react';

export default function StatusBar() {
  const [deviceCount, setDeviceCount] = useState(0);
  const [capacity, setCapacity] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    if (!window.api) return;
    try {
      const devices = await window.api.devices.list();
      setDeviceCount(devices.length);
      const cap = await window.api.accounts.getCapacity();
      setCapacity(cap);
    } catch (e) {
      // Silent fail
    }
  }

  return (
    <div className="h-7 bg-surface-900/80 border-t border-surface-800 px-4 flex items-center justify-between text-[11px] text-surface-400 select-none">
      {/* Left: Device Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {deviceCount > 0 ? (
            <Wifi size={12} className="text-success" />
          ) : (
            <WifiOff size={12} className="text-surface-500" />
          )}
          <span>{deviceCount} device{deviceCount !== 1 ? 's' : ''} connected</span>
        </div>
      </div>

      {/* Center: Capacity */}
      <div className="flex items-center gap-1.5">
        {capacity && (
          <>
            <Shield size={12} className="text-accent" />
            <span>
              {capacity.total_apps}/{capacity.total_max_apps} apps signed
              {capacity.accounts > 0 && ` across ${capacity.accounts} account${capacity.accounts !== 1 ? 's' : ''}`}
            </span>
          </>
        )}
      </div>

      {/* Right: Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span>SideloadX Ready</span>
        </div>
      </div>
    </div>
  );
}
