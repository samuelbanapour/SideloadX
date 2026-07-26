const { Tray, Menu, nativeImage } = require('electron');
const zlib = require('zlib');

/**
 * Generate a minimal valid 16x16 RGBA PNG buffer filled with a solid color
 * and a white "S" letter drawn in the center.
 */
function createTrayIconBuffer(r, g, b) {
  const size = 16;
  const channels = 4; // RGBA

  // Helper: set a pixel in the raw pixel array
  function setPixel(data, x, y, pr, pg, pb, pa) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = y * (size * channels) + x * channels;
    data[idx] = pr;
    data[idx + 1] = pg;
    data[idx + 2] = pb;
    data[idx + 3] = pa;
  }

  // Helper: draw a filled rounded square background
  function drawBackground(data, br, bg, bb) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Rounded corners: radius of 3px
        const r2 = 3;
        let draw = true;
        if (x < r2 && y < r2) {
          const dx = r2 - x - 0.5;
          const dy = r2 - y - 0.5;
          if (dx * dx + dy * dy > r2 * r2) draw = false;
        } else if (x >= size - r2 && y < r2) {
          const dx = x - (size - r2) + 0.5;
          const dy = r2 - y - 0.5;
          if (dx * dx + dy * dy > r2 * r2) draw = false;
        } else if (x < r2 && y >= size - r2) {
          const dx = r2 - x - 0.5;
          const dy = y - (size - r2) + 0.5;
          if (dx * dx + dy * dy > r2 * r2) draw = false;
        } else if (x >= size - r2 && y >= size - r2) {
          const dx = x - (size - r2) + 0.5;
          const dy = y - (size - r2) + 0.5;
          if (dx * dx + dy * dy > r2 * r2) draw = false;
        }
        if (draw) {
          setPixel(data, x, y, br, bg, bb, 255);
        }
      }
    }
  }

  // Helper: draw a small "S" letter in white
  // Defined as a bitmap pattern on an 8x10 grid, centered in 16x16
  function drawLetterS(data) {
    const white = [255, 255, 255, 255];
    // 8-wide x 10-tall bitmap for "S", row by row (1 = filled)
    const bitmap = [
      0b01111110,
      0b10000001,
      0b10000000,
      0b01111100,
      0b00000010,
      0b00000001,
      0b00000001,
      0b10000001,
      0b01111100,
    ];

    const letterW = 8;
    const letterH = bitmap.length;
    const offsetX = Math.floor((size - letterW) / 2);
    const offsetY = Math.floor((size - letterH) / 2) - 1;

    for (let row = 0; row < letterH; row++) {
      for (let col = 0; col < letterW; col++) {
        if (bitmap[row] & (1 << (letterW - 1 - col))) {
          setPixel(data, offsetX + col, offsetY + row, ...white);
        }
      }
    }
  }

  // Allocate raw pixel data (each row is prepended with a filter byte 0x00)
  const rawLen = size * (size * channels + 1);
  const rawData = Buffer.alloc(rawLen);
  for (let y = 0; y < size; y++) {
    rawData[y * (size * channels + 1)] = 0; // no filter
  }

  // Draw into a temporary pixel buffer, then copy into rawData
  const pixels = Buffer.alloc(size * size * channels, 0);
  drawBackground(pixels, r, g, b);
  drawLetterS(pixels);

  // Copy pixels into rawData (skip filter byte per row)
  for (let y = 0; y < size; y++) {
    const srcOffset = y * size * channels;
    const dstOffset = y * (size * channels + 1) + 1;
    pixels.copy(rawData, dstOffset, srcOffset, srcOffset + size * channels);
  }

  // Compress the raw data with deflate (level 9)
  const compressed = zlib.deflateSync(rawData);

  // Build PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Helper: create a PNG chunk
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // IHDR: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 6;   // color type: RGBA
  ihdrData[10] = 0;  // compression: deflate
  ihdrData[11] = 0;  // filter: adaptive
  ihdrData[12] = 0;  // interlace: none

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Color definitions for each status
const STATUS_COLORS = {
  ok:      { r: 0, g: 122, b: 255 },   // #007AFF blue
  warning: { r: 255, g: 149, b: 0 },   // #FF9500 orange
  danger:  { r: 255, g: 59, b: 48 },   // #FF3B30 red
};

/**
 * Update the tray icon to reflect a status color.
 * @param {Tray} tray - The Electron Tray instance.
 * @param {'ok'|'warning'|'danger'} status - The current status.
 */
function updateTrayIcon(tray, status) {
  if (!tray || tray.isDestroyed()) return;

  const color = STATUS_COLORS[status] || STATUS_COLORS.ok;
  const pngBuffer = createTrayIconBuffer(color.r, color.g, color.b);
  const icon = nativeImage.createFromBuffer(pngBuffer, { width: 16, height: 16 });
  tray.setImage(icon);
}

/**
 * Create and configure the system tray icon with callbacks.
 * @param {Electron.BrowserWindow} mainWindow - The main application window.
 * @param {object} callbacks
 * @param {Function} callbacks.show - Called when the user clicks "Show".
 * @param {Function} callbacks.quit - Called when the user clicks "Quit".
 * @returns {Tray}
 */
function createTray(mainWindow, callbacks = {}) {
  const onShow = callbacks.show || (() => mainWindow?.show());
  const onQuit = callbacks.quit || (() => {
    const { app } = require('electron');
    app.isQuitting = true;
    app.quit();
  });

  // Create the initial icon in accent blue (#007AFF)
  const initialBuffer = createTrayIconBuffer(0, 122, 255);
  const icon = nativeImage.createFromBuffer(initialBuffer, { width: 16, height: 16 });

  const tray = new Tray(icon);
  tray.setToolTip('SideloadX');

  function rebuildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show SideloadX',
        click: onShow,
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
        click: onQuit,
      },
    ]);
    tray.setContextMenu(contextMenu);
  }

  rebuildMenu();

  tray.on('double-click', () => {
    onShow();
  });

  return tray;
}

module.exports = { createTray, updateTrayIcon };
