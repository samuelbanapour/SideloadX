// API wrapper for IPC calls
// Falls back gracefully when running outside Electron (e.g., in a browser for dev)

const isElectron = typeof window !== 'undefined' && window.api;

const api = {
  // IPA operations
  async uploadIpa(filePath) {
    return isElectron ? window.api.ipa.upload(filePath) : null;
  },

  async getApps() {
    return isElectron ? window.api.ipa.getAll() : [];
  },

  async getApp(id) {
    return isElectron ? window.api.ipa.getMetadata(id) : null;
  },

  async removeApp(id) {
    return isElectron ? window.api.ipa.remove(id) : null;
  },

  // Certificate operations
  async getCerts() {
    return isElectron ? window.api.certs.getAll() : [];
  },

  async addCert(path, password) {
    return isElectron ? window.api.certs.add(path, password) : null;
  },

  async removeCert(id) {
    return isElectron ? window.api.certs.remove(id) : null;
  },

  // Device operations
  async getDevices() {
    return isElectron ? window.api.devices.list() : [];
  },

  async installApp(udid, ipaPath) {
    return isElectron ? window.api.devices.install(udid, ipaPath) : null;
  },

  // Account operations
  async getAccounts() {
    return isElectron ? window.api.accounts.getAll() : [];
  },

  async addAccount(appleId, password, type) {
    return isElectron ? window.api.accounts.add(appleId, password, type) : null;
  },

  async getCapacity() {
    return isElectron ? window.api.accounts.getCapacity() : { total_apps: 0, total_max_apps: 0, accounts: 0, details: [] };
  },

  // Signing
  async signApp(appId, certId, deviceId) {
    return isElectron ? window.api.sign.start(appId, certId, deviceId) : null;
  },

  // Sources
  async getSources() {
    return isElectron ? window.api.sources.getAll() : [];
  },
};

export default api;
