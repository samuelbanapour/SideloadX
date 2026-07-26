const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const { parseIpa, extractIpa, getAppMetadata, getAllApps, removeApp } = require('./services/ipa-parser');
const { addCertificate, getAllCertificates, removeCertificate, getKeychainCertificates } = require('./services/certificate-manager');
const { startSigning, getSigningStatus } = require('./services/signing-engine');
const { listDevices, getDeviceInfo, installToDevice, uninstallFromDevice, pairDevice, refreshDevices } = require('./services/device-manager');
const { addAccount, getAllAccounts, removeAccount, getCapacity, selectBestAccount, evictApp } = require('./services/account-manager');
const { getManifestUrl, getDownloadUrl, getItmsUrl } = require('./services/https-server');
const { getAllSources, addSource, removeSource, fetchSourceApps } = require('./services/sources');
const { getSetting, setSetting } = require('./services/database');

function setupIpcHandlers() {
  // IPA operations
  ipcMain.handle('ipa:pick-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'iOS App', extensions: ['ipa'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('ipa:upload', async (event, filePath) => {
    try {
      return await parseIpa(filePath);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('ipa:get-metadata', async (event, id) => {
    return getAppMetadata(id);
  });

  ipcMain.handle('ipa:get-all', async () => {
    return getAllApps();
  });

  ipcMain.handle('ipa:remove', async (event, id) => {
    return removeApp(id);
  });

  // Certificate operations
  ipcMain.handle('certs:pick-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Certificate', extensions: ['p12', 'pfx'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('certs:add', async (event, p12Path, password) => {
    try {
      return await addCertificate(p12Path, password);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('certs:get-all', async () => {
    return getAllCertificates();
  });

  ipcMain.handle('certs:remove', async (event, id) => {
    return removeCertificate(id);
  });

  ipcMain.handle('certs:get-keychain', async () => {
    return getKeychainCertificates();
  });

  // Signing operations
  ipcMain.handle('sign:start', async (event, appId, certId, deviceId) => {
    const win = BrowserWindow.getFocusedWindow();
    try {
      return await startSigning(appId, certId, deviceId, (progress) => {
        win?.webContents.send('sign:progress', { appId, ...progress });
      });
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('sign:get-status', async (event, appId) => {
    return getSigningStatus(appId);
  });

  // Device operations
  ipcMain.handle('devices:list', async () => {
    return listDevices();
  });

  ipcMain.handle('devices:get-info', async (event, udid) => {
    return getDeviceInfo(udid);
  });

  ipcMain.handle('devices:install', async (event, udid, ipaPath) => {
    try {
      return await installToDevice(udid, ipaPath);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('devices:uninstall', async (event, udid, bundleId) => {
    try {
      return await uninstallFromDevice(udid, bundleId);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('devices:pair', async (event, udid) => {
    return pairDevice(udid);
  });

  ipcMain.handle('devices:refresh', async () => {
    return refreshDevices();
  });

  // Account operations
  ipcMain.handle('accounts:add', async (event, appleId, password, type) => {
    try {
      return await addAccount(appleId, password, type);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('accounts:get-all', async () => {
    return getAllAccounts();
  });

  ipcMain.handle('accounts:remove', async (event, id) => {
    return removeAccount(id);
  });

  ipcMain.handle('accounts:get-capacity', async () => {
    return getCapacity();
  });

  ipcMain.handle('accounts:select-best', async () => {
    return selectBestAccount();
  });

  ipcMain.handle('accounts:evict-app', async (event, appId) => {
    return evictApp(appId);
  });

  // Install (OTA)
  ipcMain.handle('install:get-manifest-url', async (event, appId) => {
    return getManifestUrl(appId);
  });

  ipcMain.handle('install:get-download-url', async (event, appId) => {
    return getDownloadUrl(appId);
  });

  ipcMain.handle('install:get-itms-url', async (event, appId) => {
    return getItmsUrl(appId);
  });

  // Sources
  ipcMain.handle('sources:get-all', async () => {
    return getAllSources();
  });

  ipcMain.handle('sources:add', async (event, name, url) => {
    try {
      return await addSource(name, url);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('sources:remove', async (event, id) => {
    return removeSource(id);
  });

  ipcMain.handle('sources:fetch-apps', async (event, sourceId) => {
    return fetchSourceApps(sourceId);
  });

  // Settings
  ipcMain.handle('settings:get', async (event, key) => {
    return getSetting(key);
  });

  ipcMain.handle('settings:set', async (event, key, value) => {
    return setSetting(key, value);
  });
}

module.exports = { setupIpcHandlers };
