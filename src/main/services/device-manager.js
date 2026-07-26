const { execSync } = require('child_process');
const { getDb } = require('./database');

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch (e) {
    return null;
  }
}

function listDevices() {
  const output = runCommand('idevice_id -l');
  if (!output) return [];

  const udids = output.split('\n').filter(Boolean);
  const devices = [];

  for (const udid of udids) {
    const info = getDeviceInfo(udid);
    if (info) {
      devices.push(info);
    }
  }

  // Update database
  const db = getDb();
  for (const device of devices) {
    db.prepare(`
      INSERT OR REPLACE INTO devices (udid, name, model, product_type, os_version, connection_type, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(device.udid, device.name, device.model, device.product_type, device.os_version, device.connection_type || 'usb');
  }

  return devices;
}

function getDeviceInfo(udid) {
  const raw = runCommand(`ideviceinfo -u ${udid}`);
  if (!raw) return null;

  const info = {};
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split(': ');
    if (key && rest.length > 0) {
      info[key.trim()] = rest.join(': ').trim();
    }
  }

  return {
    udid: info.UniqueDeviceID || udid,
    name: info.DeviceName || 'Unknown Device',
    model: info.ProductType || 'Unknown',
    product_type: info.ProductType || '',
    os_version: info.ProductVersion || 'Unknown',
    build_version: info.BuildVersion || '',
    connection_type: 'usb',
    is_paired: info.PairRecord !== undefined,
  };
}

async function installToDevice(udid, ipaPath) {
  const result = runCommand(`ideviceinstaller -u ${udid} -i "${ipaPath}"`);
  return { success: true, output: result };
}

async function uninstallFromDevice(udid, bundleId) {
  const result = runCommand(`ideviceinstaller -u ${udid} -U ${bundleId}`);
  return { success: true, output: result };
}

function pairDevice(udid) {
  const result = runCommand(`idevicepair -u ${udid} pair`);
  return { success: result !== null, output: result };
}

function refreshDevices() {
  return listDevices();
}

module.exports = { listDevices, getDeviceInfo, installToDevice, uninstallFromDevice, pairDevice, refreshDevices };
