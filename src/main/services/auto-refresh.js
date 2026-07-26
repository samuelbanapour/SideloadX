const { getDb } = require('./database');

let refreshInterval = null;
let isRunning = false;

function startAutoRefresh(mainWindow) {
  if (isRunning) return;

  isRunning = true;

  // Check every 30 minutes
  refreshInterval = setInterval(async () => {
    try {
      await checkAndRefreshApps(mainWindow);
    } catch (err) {
      console.error('Auto-refresh error:', err.message);
    }
  }, 30 * 60 * 1000);

  // Also check immediately on start
  checkAndRefreshApps(mainWindow).catch(() => {});
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  isRunning = false;
}

async function checkAndRefreshApps(mainWindow) {
  const db = getDb();

  // Find apps that expire within 24 hours
  const expiringApps = db.prepare(`
    SELECT a.*, c.common_name as cert_name, c.id as cert_id
    FROM apps a
    LEFT JOIN certificates c ON a.certificate_id = c.id
    WHERE a.status = 'signed'
      AND a.expires_at IS NOT NULL
      AND datetime(a.expires_at) <= datetime('now', '+1 day')
      AND datetime(a.expires_at) > datetime('now')
  `).all();

  if (expiringApps.length === 0) return;

  console.log(`Auto-refresh: ${expiringApps.length} apps need refresh`);

  for (const app of expiringApps) {
    if (app.cert_id) {
      try {
        const { startSigning } = require('./signing-engine');
        await startSigning(app.id, app.cert_id, app.device_udid, (progress) => {
          mainWindow?.webContents.send('sign:progress', { appId: app.id, ...progress });
        });
        console.log(`Auto-refreshed: ${app.display_name || app.original_name}`);
      } catch (err) {
        console.error(`Failed to auto-refresh ${app.original_name}:`, err.message);
      }
    }
  }

  mainWindow?.webContents.send('refresh:status', {
    action: 'auto-refresh-complete',
    refreshed: expiringApps.length,
  });
}

function refreshNow(mainWindow) {
  return checkAndRefreshApps(mainWindow);
}

function getStatus() {
  return {
    is_running: isRunning,
    next_check: refreshInterval ? '30 minutes' : 'not running',
  };
}

module.exports = { startAutoRefresh, stopAutoRefresh, refreshNow, getStatus };
