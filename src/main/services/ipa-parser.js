const AdmZip = require('adm-zip');
const plist = require('plist');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('crypto');
const { execSync } = require('child_process');
const { getDb } = require('./database');

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function getUploadDir() {
  const { app } = require('electron');
  const dir = path.join(app.getPath('userData'), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function parseIpa(ipaPath) {
  const id = generateId();
  const uploadDir = getUploadDir();
  const extractDir = path.join(uploadDir, id);

  // Extract IPA
  const zip = new AdmZip(ipaPath);
  zip.extractAllTo(extractDir, true);

  // Find .app bundle
  const payloadDir = path.join(extractDir, 'Payload');
  const appDirs = fs.readdirSync(payloadDir).filter(d => d.endsWith('.app'));

  if (appDirs.length === 0) {
    throw new Error('No .app bundle found in IPA');
  }

  const appDir = appDirs[0];
  const appBundlePath = path.join(payloadDir, appDir);

  // Parse Info.plist
  const plistPath = path.join(appBundlePath, 'Info.plist');
  let plistData = {};
  if (fs.existsSync(plistPath)) {
    const plistContent = fs.readFileSync(plistPath, 'utf-8');
    plistData = plist.parse(plistContent);
  }

  // Extract app icon
  let iconPath = null;
  const iconPatterns = [
    'AppIcon60x60@2x.png',
    'AppIcon60x60@3x.png',
    'AppIcon76x76@2x.png',
    'AppIcon.png',
  ];

  // Search in Assets.car or direct icon files
  const appFiles = fs.readdirSync(appBundlePath);
  for (const pattern of iconPatterns) {
    const found = appFiles.find(f => f === pattern);
    if (found) {
      iconPath = path.join(appBundlePath, found);
      break;
    }
  }

  // Copy icon to uploads
  let iconDest = null;
  if (iconPath && fs.existsSync(iconPath)) {
    iconDest = path.join(uploadDir, `${id}_icon.png`);
    fs.copyFileSync(iconPath, iconDest);
  }

  // Extract entitlements
  let entitlements = null;
  try {
    const entitlementsRaw = execSync(
      `codesign -d --entitlements - "${appBundlePath}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    if (entitlementsRaw.trim()) {
      entitlements = plist.parse(entitlementsRaw);
    }
  } catch (e) {
    // Entitlements extraction failed - that's okay
  }

  // Get app metadata
  const metadata = {
    id,
    original_name: path.basename(ipaPath),
    bundle_id: plistData.CFBundleIdentifier || 'Unknown',
    display_name: plistData.CFBundleDisplayName || plistData.CFBundleName || path.basename(ipaPath, '.ipa'),
    version: plistData.CFBundleShortVersionString || plistData.CFBundleVersion || '1.0',
    min_os: plistData.MinimumOSVersion || '12.0',
    ipa_path: ipaPath,
    extract_dir: extractDir,
    app_bundle_path: appBundlePath,
    icon_path: iconDest,
    entitlements,
    status: 'uploaded',
    created_at: new Date().toISOString(),
  };

  // Save to database
  const db = getDb();
  db.prepare(`
    INSERT INTO apps (id, original_name, bundle_id, display_name, version, min_os, icon_path, ipa_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metadata.id,
    metadata.original_name,
    metadata.bundle_id,
    metadata.display_name,
    metadata.version,
    metadata.min_os,
    metadata.icon_path,
    metadata.ipa_path,
    metadata.status
  );

  return metadata;
}

function getAppMetadata(id) {
  return getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id);
}

function getAllApps() {
  return getDb().prepare('SELECT * FROM apps ORDER BY created_at DESC').all();
}

function removeApp(id) {
  const app = getDb().prepare('SELECT * FROM apps WHERE id = ?').get(id);
  if (app) {
    // Clean up files
    if (app.icon_path && fs.existsSync(app.icon_path)) {
      fs.unlinkSync(app.icon_path);
    }
    if (app.extract_dir && fs.existsSync(app.extract_dir)) {
      fs.rmSync(app.extract_dir, { recursive: true, force: true });
    }
    getDb().prepare('DELETE FROM apps WHERE id = ?').run(id);
  }
  return { success: true };
}

module.exports = { parseIpa, getAppMetadata, getAllApps, removeApp, getUploadDir };
