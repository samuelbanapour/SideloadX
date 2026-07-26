const https = require('https');
const http = require('http');
const selfsigned = require('selfsigned');
const { getDb } = require('./database');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let server = null;
let serverPort = 8443;

function getManifestUrl(appId) {
  const ipa = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(appId);
  if (!ipa || !ipa.signed_ipa_path) return null;
  return `https://localhost:${serverPort}/manifest/${appId}`;
}

function getDownloadUrl(appId) {
  const ipa = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(appId);
  if (!ipa || !ipa.signed_ipa_path) return null;
  return `https://localhost:${serverPort}/download/${appId}`;
}

function getItmsUrl(appId) {
  const manifestUrl = getManifestUrl(appId);
  if (!manifestUrl) return null;
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
}

function generateManifest(appData) {
  const ipaUrl = `https://localhost:${serverPort}/download/${appData.id}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${ipaUrl}</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>${appData.bundle_id || 'com.unknown'}</string>
                <key>bundle-version</key>
                <string>${appData.version || '1.0'}</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>${appData.display_name || appData.original_name}</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
}

function startServer(port = 8443) {
  if (server) return;

  serverPort = port;

  // Generate self-signed certificate
  const attrs = [{ name: 'commonName', value: 'SideloadX Local Server' }];
  const pems = selfsigned.generate(attrs, { days: 365 });

  const options = {
    key: pems.private,
    cert: pems.cert,
  };

  server = https.createServer(options, (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url.startsWith('/manifest/')) {
      const appId = req.url.split('/manifest/')[1];
      const appData = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(appId);
      if (!appData) {
        res.writeHead(404);
        res.end('App not found');
        return;
      }
      const manifest = generateManifest(appData);
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(manifest);
    } else if (req.url.startsWith('/download/')) {
      const appId = req.url.split('/download/')[1];
      const appData = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(appId);
      if (!appData || !appData.signed_ipa_path || !fs.existsSync(appData.signed_ipa_path)) {
        res.writeHead(404);
        res.end('IPA not found');
        return;
      }
      const ipaPath = appData.signed_ipa_path;
      const fileName = path.basename(ipaPath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      fs.createReadStream(ipaPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`SideloadX HTTPS server running on port ${port}`);
  });

  server.on('error', (err) => {
    console.error('HTTPS server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}`);
      startServer(port + 1);
    }
  });
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startServer, stopServer, getManifestUrl, getDownloadUrl, getItmsUrl };
