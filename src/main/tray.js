const { Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');

function createTray(mainWindow) {
  // Create a simple tray icon (16x16 colored square as placeholder)
  const icon = nativeImage.createEmpty();

  const tray = new Tray(icon);
  tray.setToolTip('SideloadX');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show SideloadX',
      click: () => mainWindow?.show(),
    },
    { type: 'separator' },
    {
      label: 'Refresh All Apps',
      click: () => {
        mainWindow?.webContents.send('refresh:status', { action: 'refresh-all' });
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit SideloadX',
      click: () => {
        const { app } = require('electron');
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });

  return tray;
}

function updateTrayStatus(tray, status) {
  // status: 'ok' | 'warning' | 'danger'
  // Would update tray icon color here
}

module.exports = { createTray, updateTrayStatus };
