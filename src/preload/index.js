const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to renderer
contextBridge.exposeInMainWorld('api', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleDevTools: () => ipcRenderer.send('window:toggle-devtools'),
  },

  // IPA operations
  ipa: {
    upload: (filePath) => ipcRenderer.invoke('ipa:upload', filePath),
    getMetadata: (id) => ipcRenderer.invoke('ipa:get-metadata', id),
    getAll: () => ipcRenderer.invoke('ipa:get-all'),
    remove: (id) => ipcRenderer.invoke('ipa:remove', id),
    pickFile: () => ipcRenderer.invoke('ipa:pick-file'),
  },

  // Certificate operations
  certs: {
    add: (p12Path, password) => ipcRenderer.invoke('certs:add', p12Path, password),
    getAll: () => ipcRenderer.invoke('certs:get-all'),
    remove: (id) => ipcRenderer.invoke('certs:remove', id),
    getKeychainCerts: () => ipcRenderer.invoke('certs:get-keychain'),
    pickFile: () => ipcRenderer.invoke('certs:pick-file'),
  },

  // Signing operations
  sign: {
    start: (appId, certId, deviceId) => ipcRenderer.invoke('sign:start', appId, certId, deviceId),
    getStatus: (appId) => ipcRenderer.invoke('sign:get-status', appId),
  },

  // Device operations
  devices: {
    list: () => ipcRenderer.invoke('devices:list'),
    getInfo: (udid) => ipcRenderer.invoke('devices:get-info', udid),
    install: (udid, ipaPath) => ipcRenderer.invoke('devices:install', udid, ipaPath),
    uninstall: (udid, bundleId) => ipcRenderer.invoke('devices:uninstall', udid, bundleId),
    pair: (udid) => ipcRenderer.invoke('devices:pair', udid),
    refresh: () => ipcRenderer.invoke('devices:refresh'),
  },

  // Account operations
  accounts: {
    add: (appleId, password, type) => ipcRenderer.invoke('accounts:add', appleId, password, type),
    getAll: () => ipcRenderer.invoke('accounts:get-all'),
    remove: (id) => ipcRenderer.invoke('accounts:remove', id),
    getCapacity: () => ipcRenderer.invoke('accounts:get-capacity'),
    selectBest: () => ipcRenderer.invoke('accounts:select-best'),
    evictApp: (appId) => ipcRenderer.invoke('accounts:evict-app', appId),
  },

  // Auto-refresh
  refresh: {
    start: () => ipcRenderer.invoke('refresh:start'),
    stop: () => ipcRenderer.invoke('refresh:stop'),
    getStatus: () => ipcRenderer.invoke('refresh:get-status'),
    refreshNow: () => ipcRenderer.invoke('refresh:refresh-now'),
  },

  // Install (OTA)
  install: {
    getManifestUrl: (appId) => ipcRenderer.invoke('install:get-manifest-url', appId),
    getDownloadUrl: (appId) => ipcRenderer.invoke('install:get-download-url', appId),
    getItmsUrl: (appId) => ipcRenderer.invoke('install:get-itms-url', appId),
  },

  // Sources
  sources: {
    getAll: () => ipcRenderer.invoke('sources:get-all'),
    add: (name, url) => ipcRenderer.invoke('sources:add', name, url),
    remove: (id) => ipcRenderer.invoke('sources:remove', id),
    fetchApps: (sourceId) => ipcRenderer.invoke('sources:fetch-apps', sourceId),
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },

  // Events from main process
  on: (channel, callback) => {
    const validChannels = [
      'sign:progress',
      'device:connected',
      'device:disconnected',
      'refresh:status',
      'toast:show',
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});
