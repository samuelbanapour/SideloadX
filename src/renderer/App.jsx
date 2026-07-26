import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';
import StatusBar from './components/layout/StatusBar';
import LibraryPage from './pages/LibraryPage';
import DevicesPage from './pages/DevicesPage';
import CertificatesPage from './pages/CertificatesPage';
import AccountsPage from './pages/AccountsPage';
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';

const pages = {
  library: LibraryPage,
  devices: DevicesPage,
  certificates: CertificatesPage,
  accounts: AccountsPage,
  sources: SourcesPage,
  settings: SettingsPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('library');
  const [toast, setToast] = useState(null);

  const PageComponent = pages[currentPage] || LibraryPage;

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="h-screen flex flex-col bg-surface-950">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <PageComponent showToast={showToast} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-16 left-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 ${
              toast.type === 'error' ? 'bg-danger text-white' :
              toast.type === 'success' ? 'bg-success text-white' :
              'bg-surface-700 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
