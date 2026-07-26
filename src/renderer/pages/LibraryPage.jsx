import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import IPADropzone from '../components/library/IPADropzone';
import AppGrid from '../components/library/AppGrid';
import SigningSteps from '../components/shared/SigningSteps';

export default function LibraryPage({ showToast }) {
  const [apps, setApps] = useState([]);
  const [signingApp, setSigningApp] = useState(null);
  const [signingStep, setSigningStep] = useState(null);
  const [devices, setDevices] = useState([]);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    loadApps();
    loadDevices();
    loadCerts();

    // Listen for signing progress
    const unsub = window.api?.on('sign:progress', (data) => {
      setSigningStep(data.step);
      if (data.step === 'complete') {
        setTimeout(() => {
          setSigningApp(null);
          setSigningStep(null);
          loadApps();
          showToast('App signed successfully!', 'success');
        }, 1500);
      }
    });

    return () => unsub?.();
  }, []);

  async function loadApps() {
    if (!window.api) return;
    const data = await window.api.ipa.getAll();
    setApps(data || []);
  }

  async function loadDevices() {
    if (!window.api) return;
    const data = await window.api.devices.list();
    setDevices(data || []);
  }

  async function loadCerts() {
    if (!window.api) return;
    const data = await window.api.certs.getAll();
    setCerts(data || []);
  }

  async function handleFileSelected(filePath) {
    if (!window.api) {
      showToast('API not available - running outside Electron', 'error');
      return;
    }
    const result = await window.api.ipa.upload(filePath);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Added: ${result.display_name || result.original_name}`, 'success');
      loadApps();
    }
  }

  async function handleSign(app) {
    if (!window.api) return;

    if (certs.length === 0) {
      showToast('No certificates found. Add a certificate first.', 'error');
      return;
    }

    setSigningApp(app);
    setSigningStep('extract');

    const result = await window.api.sign.start(app.id, certs[0].id, devices[0]?.udid);
    if (result?.error) {
      showToast(result.error, 'error');
      setSigningApp(null);
      setSigningStep(null);
    }
  }

  async function handleInstall(app) {
    if (!window.api) return;
    if (devices.length === 0) {
      showToast('No devices connected. Connect a device first.', 'error');
      return;
    }

    const result = await window.api.devices.install(devices[0].udid, app.signed_ipa_path);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Installing ${app.display_name}...`, 'success');
    }
  }

  async function handleRemove(app) {
    if (!window.api) return;
    await window.api.ipa.remove(app.id);
    showToast('App removed', 'success');
    loadApps();
  }

  async function handlePin(app) {
    if (!window.api) return;
    const result = await window.api.ipa.togglePin(app.id);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast(result.pinned ? 'App pinned' : 'App unpinned', 'success');
      loadApps();
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">App Library</h1>
          <p className="text-sm text-surface-400 mt-1">
            {apps.length} app{apps.length !== 1 ? 's' : ''} in library
          </p>
        </div>
        <button onClick={loadApps} className="btn-ghost text-sm">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Dropzone */}
      <IPADropzone onFileSelected={handleFileSelected} />

      {/* Signing Progress Modal */}
      {signingApp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-96 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Signing: {signingApp.display_name || signingApp.original_name}
            </h3>
            <SigningSteps currentStep={signingStep} />
          </motion.div>
        </motion.div>
      )}

      {/* App Grid */}
      <AppGrid
        apps={apps}
        onSign={handleSign}
        onInstall={handleInstall}
        onRemove={handleRemove}
        onPin={handlePin}
      />
    </div>
  );
}
