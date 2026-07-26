const forge = require('node-forge');
const { getDb } = require('./database');

function addAccount(appleId, password, type = 'free') {
  const db = getDb();

  // Check if account already exists
  const existing = db.prepare('SELECT id FROM accounts WHERE apple_id = ?').get(appleId);
  if (existing) {
    return { error: 'Account already added' };
  }

  // Hash password (simple hash - in production use bcrypt)
  const md = forge.md.md5.create();
  md.update(password || '');
  const passwordHash = md.digest().toHex();

  const maxApps = type === 'paid' || type === 'enterprise' ? 999 : 3;
  const maxDevices = type === 'paid' ? 100 : type === 'enterprise' ? 999 : 10;

  const result = db.prepare(`
    INSERT INTO accounts (apple_id, password_hash, account_type, display_name, max_apps, max_devices)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(appleId, passwordHash, type, appleId.split('@')[0], maxApps, maxDevices);

  return {
    id: result.lastInsertRowid,
    apple_id: appleId,
    account_type: type,
    max_apps: maxApps,
    max_devices: maxDevices,
  };
}

function getAllAccounts() {
  const db = getDb();
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();

  // Update current counts
  for (const account of accounts) {
    const appCount = db.prepare('SELECT COUNT(*) as count FROM apps WHERE account_id = ? AND status IN ("signed", "installed")').get(account.id);
    const deviceCount = db.prepare('SELECT COUNT(DISTINCT device_udid) as count FROM apps WHERE account_id = ? AND device_udid IS NOT NULL').get(account.id);
    account.current_apps = appCount?.count || 0;
    account.current_devices = deviceCount?.count || 0;
  }

  return accounts;
}

function removeAccount(id) {
  const db = getDb();
  // Unassign apps from this account
  db.prepare('UPDATE apps SET account_id = NULL WHERE account_id = ?').run(id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return { success: true };
}

function getCapacity() {
  const accounts = getAllAccounts();
  let totalApps = 0;
  let totalMaxApps = 0;
  let totalDevices = 0;
  let totalMaxDevices = 0;

  for (const acc of accounts) {
    totalApps += acc.current_apps;
    totalMaxApps += acc.max_apps;
    totalDevices += acc.current_devices;
    totalMaxDevices += acc.max_devices;
  }

  return {
    accounts: accounts.length,
    total_apps: totalApps,
    total_max_apps: totalMaxApps,
    total_devices: totalDevices,
    total_max_devices: totalMaxDevices,
    details: accounts.map(a => ({
      id: a.id,
      apple_id: a.apple_id,
      type: a.account_type,
      apps_used: a.current_apps,
      apps_max: a.max_apps,
      devices_used: a.current_devices,
      devices_max: a.max_devices,
      is_full: a.current_apps >= a.max_apps,
    })),
  };
}

function selectBestAccount() {
  const db = getDb();
  const accounts = db.prepare(`
    SELECT a.*, COUNT(ap.id) as signed_apps
    FROM accounts a
    LEFT JOIN apps ap ON ap.account_id = a.id AND ap.status IN ('signed', 'installed')
    WHERE a.is_active = 1
    GROUP BY a.id
    HAVING signed_apps < a.max_apps
    ORDER BY (a.max_apps - signed_apps) DESC
    LIMIT 1
  `).get();

  return accounts || null;
}

function evictApp(appId) {
  const db = getDb();
  const app = db.prepare(`
    SELECT * FROM apps
    WHERE id = ? AND pinned = 0 AND status IN ('signed', 'installed')
    ORDER BY expires_at ASC
    LIMIT 1
  `).get(appId);

  if (!app) {
    return { error: 'No evictable app found (app may be pinned or not signed)' };
  }

  // Update status
  db.prepare("UPDATE apps SET status = 'evicted' WHERE id = ?").run(app.id);

  // If installed on device, try to uninstall
  if (app.device_udid && app.bundle_id) {
    try {
      const { uninstallFromDevice } = require('./device-manager');
      uninstallFromDevice(app.device_udid, app.bundle_id);
    } catch (e) {
      // Best effort
    }
  }

  return { success: true, evicted: app.display_name || app.original_name };
}

module.exports = { addAccount, getAllAccounts, removeAccount, getCapacity, selectBestAccount, evictApp };
