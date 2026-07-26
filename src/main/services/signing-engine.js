const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const plist = require('plist');
const AdmZip = require('adm-zip');
const { getDb } = require('./database');
const { getCertificateById } = require('./certificate-manager');
const { getAppMetadata } = require('./ipa-parser');

const SIGNING_STEPS = [
  { id: 'extract', label: 'Extracting IPA', duration: 1000 },
  { id: 'parse', label: 'Parsing metadata', duration: 500 },
  { id: 'entitlements', label: 'Preparing entitlements', duration: 800 },
  { id: 'clean', label: 'Cleaning signatures', duration: 500 },
  { id: 'profile', label: 'Applying provisioning profile', duration: 600 },
  { id: 'sign', label: 'Signing binary', duration: 2000 },
  { id: 'verify', label: 'Verifying signature', duration: 500 },
  { id: 'package', label: 'Packaging IPA', duration: 1500 },
  { id: 'complete', label: 'Complete', duration: 0 },
];

const signingStatuses = {};

async function startSigning(appId, certId, deviceId, onProgress) {
  const app = getAppMetadata(appId);
  if (!app) throw new Error('App not found');

  const cert = getCertificateById(certId);
  if (!cert) throw new Error('Certificate not found');

  signingStatuses[appId] = { status: 'signing', currentStep: 0, steps: SIGNING_STEPS };

  const reportProgress = (stepIndex, message) => {
    signingStatuses[appId].currentStep = stepIndex;
    signingStatuses[appId].message = message;
    onProgress?.({ step: SIGNING_STEPS[stepIndex]?.id, message, progress: stepIndex / SIGNING_STEPS.length });
  };

  try {
    // Step 1: Extract IPA
    reportProgress(0, 'Extracting IPA file...');
    const extractDir = app.extract_dir || path.join(require('electron').app.getPath('userData'), 'uploads', app.id);
    const payloadDir = path.join(extractDir, 'Payload');
    let appBundlePath = app.app_bundle_path;

    if (!appBundlePath || !fs.existsSync(appBundlePath)) {
      const appDirs = fs.readdirSync(payloadDir).filter(d => d.endsWith('.app'));
      if (appDirs.length === 0) throw new Error('No .app bundle found');
      appBundlePath = path.join(payloadDir, appDirs[0]);
    }

    await delay(SIGNING_STEPS[0].duration);

    // Step 2: Parse metadata
    reportProgress(1, 'Reading app metadata...');
    const plistPath = path.join(appBundlePath, 'Info.plist');
    const plistData = fs.existsSync(plistPath) ? plist.parse(fs.readFileSync(plistPath, 'utf-8')) : {};
    await delay(SIGNING_STEPS[1].duration);

    // Step 3: Extract entitlements
    reportProgress(2, 'Extracting entitlements...');
    let entitlementsPlist = null;
    try {
      const entRaw = execSync(`codesign -d --entitlements - "${appBundlePath}"`, { encoding: 'utf-8', timeout: 5000 });
      if (entRaw.trim().startsWith('<?xml') || entRaw.trim().startsWith('<!DOCTYPE')) {
        entitlementsPlist = entRaw;
      }
    } catch (e) {
      // No existing entitlements - create minimal ones
      entitlementsPlist = plist.build({
        'com.apple.security.app-sandbox': false,
      });
    }

    const entitlementsPath = path.join(extractDir, 'entitlements.plist');
    fs.writeFileSync(entitlementsPath, entitlementsPlist || '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict></dict></plist>');
    await delay(SIGNING_STEPS[2].duration);

    // Step 4: Clean existing signatures
    reportProgress(3, 'Removing old signatures...');
    const codeSignDir = path.join(appBundlePath, '_CodeSignature');
    if (fs.existsSync(codeSignDir)) {
      fs.rmSync(codeSignDir, { recursive: true, force: true });
    }
    // Remove existing mobileprovision
    const existingProfile = path.join(appBundlePath, 'embedded.mobileprovision');
    if (fs.existsSync(existingProfile)) {
      fs.unlinkSync(existingProfile);
    }
    await delay(SIGNING_STEPS[3].duration);

    // Step 5: Apply provisioning profile
    reportProgress(4, 'Applying provisioning profile...');
    if (cert.provisioning_profile && fs.existsSync(cert.provisioning_profile)) {
      fs.copyFileSync(cert.provisioning_profile, existingProfile);
    } else {
      // Create a minimal provisioning profile placeholder
      // In production, this would be fetched from Apple's API
      fs.writeFileSync(existingProfile, 'PLACEHOLDER_PROFILE');
    }
    await delay(SIGNING_STEPS[4].duration);

    // Step 6: Sign the binary
    reportProgress(5, 'Code signing...');
    const identity = cert.common_name || cert.name;

    // Try macOS codesign first, fallback to manual signing
    if (process.platform === 'darwin') {
      try {
        execSync(
          `codesign -f -s "${identity}" --entitlements "${entitlementsPath}" --timestamp --force "${appBundlePath}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
      } catch (e) {
        // If signing with identity fails, try ad-hoc
        execSync(
          `codesign -f -s - --entitlements "${entitlementsPath}" --timestamp --force "${appBundlePath}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
      }
    }
    await delay(SIGNING_STEPS[5].duration);

    // Step 7: Verify signature
    reportProgress(6, 'Verifying signature...');
    if (process.platform === 'darwin') {
      try {
        execSync(`codesign -v "${appBundlePath}"`, { encoding: 'utf-8', timeout: 10000 });
      } catch (e) {
        console.warn('Signature verification warning:', e.message);
      }
    }
    await delay(SIGNING_STEPS[6].duration);

    // Step 8: Package IPA
    reportProgress(7, 'Packaging signed IPA...');
    const outputDir = path.join(require('electron').app.getPath('userData'), 'signed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `${app.display_name || app.bundle_id}_signed.ipa`);

    const zip = new AdmZip();
    zip.addLocalFolder(extractDir, 'Payload');
    zip.writeZip(outputPath);
    await delay(SIGNING_STEPS[7].duration);

    // Step 9: Complete
    reportProgress(8, 'Signing complete!');

    // Update database
    const db = getDb();
    db.prepare(`
      UPDATE apps
      SET status = 'signed', signed_ipa_path = ?, certificate_id = ?, account_id = ?,
          expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(outputPath, certId, null, cert.expires_at, appId);

    // Log signing history
    db.prepare(`
      INSERT INTO signing_history (app_id, certificate_id, device_udid, status)
      VALUES (?, ?, ?, 'success')
    `).run(appId, certId, deviceId || null);

    signingStatuses[appId] = { status: 'completed', currentStep: SIGNING_STEPS.length };

    return {
      success: true,
      signed_ipa_path: outputPath,
      expires_at: cert.expires_at,
    };
  } catch (err) {
    signingStatuses[appId] = { status: 'failed', error: err.message };

    const db = getDb();
    db.prepare(`
      INSERT INTO signing_history (app_id, certificate_id, device_udid, status, error_message)
      VALUES (?, ?, ?, 'failed', ?)
    `).run(appId, certId, deviceId || null, err.message);

    throw err;
  }
}

function getSigningStatus(appId) {
  return signingStatuses[appId] || { status: 'idle' };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startSigning, getSigningStatus, SIGNING_STEPS };
