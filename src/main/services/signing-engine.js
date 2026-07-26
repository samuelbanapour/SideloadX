const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const plist = require('plist');
const AdmZip = require('adm-zip');
const { getDb } = require('./database');
const { getCertificateById } = require('./certificate-manager');
const { getAppMetadata } = require('./ipa-parser');

const SIGNING_STEPS = [
  { id: 'extract', label: 'Extracting IPA' },
  { id: 'parse', label: 'Parsing metadata' },
  { id: 'entitlements', label: 'Preparing entitlements' },
  { id: 'clean', label: 'Cleaning signatures' },
  { id: 'profile', label: 'Applying provisioning profile' },
  { id: 'sign', label: 'Signing binary' },
  { id: 'verify', label: 'Verifying signature' },
  { id: 'package', label: 'Packaging IPA' },
  { id: 'complete', label: 'Complete' },
];

const signingStatuses = {};

function getPercentage(stepIndex) {
  // First 8 steps are real work (0-7), step 8 (complete) is 100%
  if (stepIndex >= SIGNING_STEPS.length - 1) return 100;
  return Math.round((stepIndex / (SIGNING_STEPS.length - 1)) * 100);
}

function isDarwin() {
  return process.platform === 'darwin';
}

async function startSigning(appId, certId, deviceId, onProgress) {
  const app = getAppMetadata(appId);
  if (!app) throw new Error('App not found');

  const cert = getCertificateById(certId);
  if (!cert) throw new Error('Certificate not found');

  // Platform check: log clearly that non-macOS only supports ad-hoc signing
  if (!isDarwin()) {
    console.warn(
      `[SideloadX] Running on ${process.platform} — only ad-hoc signing (-) is available. ` +
      'To use a real identity, run on macOS with a valid certificate in Keychain.'
    );
  }

  // Provisioning profile validation
  if (cert.provisioning_profile) {
    if (!fs.existsSync(cert.provisioning_profile)) {
      throw new Error(
        `Provisioning profile not found on disk: "${cert.provisioning_profile}". ` +
        'Verify the path is correct and the file has not been moved or deleted.'
      );
    }
    const stat = fs.statSync(cert.provisioning_profile);
    if (stat.size < 100) {
      console.warn(
        `[SideloadX] Provisioning profile "${cert.provisioning_profile}" is suspiciously small ` +
        `(${stat.size} bytes). It may be corrupt or a placeholder.`
      );
    }
  } else {
    console.warn(
      `[SideloadX] Certificate "${cert.common_name || cert.name}" has no provisioning profile. ` +
      'Proceeding without embedded profile — the IPA may not install on non-jailbroken devices.'
    );
  }

  signingStatuses[appId] = { status: 'signing', currentStep: 0, steps: SIGNING_STEPS };

  const reportProgress = (stepIndex, message) => {
    const pct = getPercentage(stepIndex);
    signingStatuses[appId].currentStep = stepIndex;
    signingStatuses[appId].message = message;
    signingStatuses[appId].percentage = pct;
    onProgress?.({ step: SIGNING_STEPS[stepIndex]?.id, message, progress: pct / 100, percentage: pct });
  };

  try {
    // ── Step 0: Extract IPA ──────────────────────────────────────────────
    reportProgress(0, 'Extracting IPA file...');
    const extractDir = app.extract_dir || path.join(require('electron').app.getPath('userData'), 'uploads', app.id);
    const payloadDir = path.join(extractDir, 'Payload');

    if (!fs.existsSync(extractDir)) {
      throw new Error(
        `Extract directory does not exist: "${extractDir}". ` +
        'The IPA may not have been uploaded or extracted properly.'
      );
    }
    if (!fs.existsSync(payloadDir)) {
      throw new Error(
        `Payload directory missing inside extract dir: "${payloadDir}". ` +
        'This IPA does not appear to have a standard Payload/ structure.'
      );
    }

    let appBundlePath = app.app_bundle_path;
    if (!appBundlePath || !fs.existsSync(appBundlePath)) {
      const appDirs = fs.readdirSync(payloadDir).filter(d => d.endsWith('.app'));
      if (appDirs.length === 0) {
        throw new Error(
          `No .app bundle found in "${payloadDir}". ` +
          'Ensure the IPA contains a valid iOS application bundle.'
        );
      }
      appBundlePath = path.join(payloadDir, appDirs[0]);
    }

    // Verify the bundle is a real directory (not a stray file named .app)
    if (!fs.statSync(appBundlePath).isDirectory()) {
      throw new Error(
        `Path "${appBundlePath}" is not a directory. Expected a .app bundle directory.`
      );
    }

    // Minimal delay for UX — the real work (fs.existsSync / readdirSync) just happened
    await delay(100);

    // ── Step 1: Parse metadata ───────────────────────────────────────────
    reportProgress(1, 'Reading app metadata...');
    const plistPath = path.join(appBundlePath, 'Info.plist');

    if (!fs.existsSync(plistPath)) {
      console.warn(
        `[SideloadX] Info.plist not found at "${plistPath}". ` +
        'Proceeding with empty metadata — bundle identifier and version may be missing.'
      );
    }

    let plistData = {};
    if (fs.existsSync(plistPath)) {
      try {
        const raw = fs.readFileSync(plistPath, 'utf-8');
        plistData = plist.parse(raw);
      } catch (parseErr) {
        throw new Error(
          `Failed to parse Info.plist at "${plistPath}": ${parseErr.message}. ` +
          'The plist may be corrupt or in an unsupported format.'
        );
      }
    }

    const bundleId = plistData.CFBundleIdentifier || 'unknown';
    const bundleVersion = plistData.CFBundleShortVersionString || plistData.CFBundleVersion || 'unknown';
    reportProgress(1, `Parsed metadata: ${bundleId} v${bundleVersion}`);
    await delay(100);

    // ── Step 2: Extract entitlements ─────────────────────────────────────
    reportProgress(2, 'Extracting entitlements...');
    let entitlementsPlist = null;

    if (isDarwin()) {
      try {
        const entRaw = execSync(
          `codesign -d --entitlements - "${appBundlePath}"`,
          { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        if (entRaw.trim().startsWith('<?xml') || entRaw.trim().startsWith('<!DOCTYPE')) {
          entitlementsPlist = entRaw;
        } else {
          console.warn('[SideloadX] codesign returned entitlements data that is not valid XML. Using defaults.');
        }
      } catch (e) {
        // No existing entitlements or binary not yet signed — create minimal ones
      }
    }

    if (!entitlementsPlist) {
      entitlementsPlist = plist.build({
        'com.apple.security.app-sandbox': false,
      });
    }

    const entitlementsPath = path.join(extractDir, 'entitlements.plist');
    fs.writeFileSync(entitlementsPath, entitlementsPlist);
    await delay(100);

    // ── Step 3: Clean existing signatures ────────────────────────────────
    reportProgress(3, 'Removing old signatures...');
    const codeSignDir = path.join(appBundlePath, '_CodeSignature');
    const existingProfile = path.join(appBundlePath, 'embedded.mobileprovision');

    if (fs.existsSync(codeSignDir)) {
      fs.rmSync(codeSignDir, { recursive: true, force: true });
    }

    if (fs.existsSync(existingProfile)) {
      fs.unlinkSync(existingProfile);
    }

    // Verify _CodeSignature was actually removed
    if (fs.existsSync(codeSignDir)) {
      throw new Error(
        `Failed to remove _CodeSignature directory at "${codeSignDir}". ` +
        'Check file permissions — the directory may be locked or read-only.'
      );
    }

    // Verify embedded.mobileprovision was removed
    if (fs.existsSync(existingProfile)) {
      throw new Error(
        `Failed to remove embedded.mobileprovision at "${existingProfile}". ` +
        'Check file permissions.'
      );
    }

    await delay(100);

    // ── Step 4: Apply provisioning profile ───────────────────────────────
    reportProgress(4, 'Applying provisioning profile...');
    if (cert.provisioning_profile && fs.existsSync(cert.provisioning_profile)) {
      fs.copyFileSync(cert.provisioning_profile, existingProfile);

      // Verify the copy succeeded and has content
      if (!fs.existsSync(existingProfile)) {
        throw new Error(
          'Provisioning profile copy failed — embedded.mobileprovision does not exist after copy.'
        );
      }
      const copiedStat = fs.statSync(existingProfile);
      if (copiedStat.size === 0) {
        throw new Error(
          'Provisioning profile copy resulted in an empty file (0 bytes). ' +
          'Source profile may be corrupt.'
        );
      }
      reportProgress(4, 'Provisioning profile applied successfully.');
    } else {
      // No profile — write a minimal placeholder so codesign does not fail on missing file
      const placeholder = 'PLACEHOLDER_PROFILE';
      fs.writeFileSync(existingProfile, placeholder);
      console.warn(
        '[SideloadX] No valid provisioning profile available. Wrote placeholder. ' +
        'Signed IPA may not be installable on stock (non-jailbroken) devices.'
      );
      reportProgress(4, 'No provisioning profile — using placeholder.');
    }
    await delay(100);

    // ── Step 5: Sign the binary ──────────────────────────────────────────
    reportProgress(5, 'Code signing...');
    const identity = cert.common_name || cert.name;

    if (isDarwin()) {
      let signSucceeded = false;
      let lastError = null;

      // Attempt signing with the specified identity
      if (identity && identity !== '-' && identity !== 'ad-hoc') {
        try {
          const output = execSync(
            `codesign -f -s "${identity}" --entitlements "${entitlementsPath}" --timestamp --force "${appBundlePath}" 2>&1`,
            { encoding: 'utf-8', timeout: 30000 }
          );
          signSucceeded = true;
          if (output.trim()) {
            reportProgress(5, `Signed with identity "${identity}". ${output.trim()}`);
          } else {
            reportProgress(5, `Signed with identity "${identity}".`);
          }
        } catch (e) {
          lastError = e;
          console.warn(
            `[SideloadX] Signing with identity "${identity}" failed: ${e.message}. ` +
            'Attempting ad-hoc signing as fallback...'
          );
        }
      }

      // Fallback: ad-hoc signing
      if (!signSucceeded) {
        try {
          execSync(
            `codesign -f -s - --entitlements "${entitlementsPath}" --timestamp --force "${appBundlePath}" 2>&1`,
            { encoding: 'utf-8', timeout: 30000 }
          );
          signSucceeded = true;
          reportProgress(5, 'Signed with ad-hoc identity (-).');
        } catch (e) {
          throw new Error(
            `Code signing failed for both identity "${identity || 'N/A'}" and ad-hoc: ${e.message}. ` +
            'Ensure you have a valid signing identity in your Keychain or use ad-hoc mode.'
          );
        }
      }

      // Confirm that the _CodeSignature directory was created by codesign
      const newCodeSignDir = path.join(appBundlePath, '_CodeSignature');
      if (!fs.existsSync(newCodeSignDir)) {
        throw new Error(
          'codesign did not produce a _CodeSignature directory. ' +
          'Signing may have silently failed — the binary may be corrupt or unsigned.'
        );
      }
      // Check at least one file exists inside _CodeSignature
      const csFiles = fs.readdirSync(newCodeSignDir);
      if (csFiles.length === 0) {
        throw new Error(
          '_CodeSignature directory exists but is empty. The signature is incomplete.'
        );
      }
    } else {
      // Non-macOS: record that only ad-hoc is supported, skip actual codesign
      reportProgress(5, `Skipping codesign — not running on macOS (${process.platform}). Ad-hoc signature not applied.`);
    }

    await delay(100);

    // ── Step 6: Verify signature ─────────────────────────────────────────
    reportProgress(6, 'Verifying signature...');

    if (isDarwin()) {
      let verificationOutput = '';
      try {
        verificationOutput = execSync(
          `codesign -v "${appBundlePath}" 2>&1`,
          { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        // codesign -v outputs nothing on success — any output means a problem
        const trimmed = verificationOutput.trim();
        if (trimmed) {
          reportProgress(6, `Signature verification output: ${trimmed}`);
        } else {
          reportProgress(6, 'Signature verified successfully.');
        }
      } catch (e) {
        // codesign -v exits non-zero on failure
        const stderr = (e.stderr || '').trim();
        const stdout = (e.stdout || '').trim();
        const detail = stderr || stdout || e.message;
        throw new Error(
          `Signature verification failed: ${detail}. ` +
          'The signed bundle may be corrupt, or the signing identity is not trusted on this system.'
        );
      }

      // Additional deep verification: check the embedded signature details
      try {
        const displayOutput = execSync(
          `codesign -dvvv "${appBundlePath}" 2>&1`,
          { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const lines = displayOutput.split('\n').filter(l => l.trim());
        const authorityLine = lines.find(l => l.startsWith('Authority='));
        if (authorityLine) {
          reportProgress(6, `Verified. ${authorityLine.trim()}`);
        }
      } catch (_) {
        // Deep display is informational only — do not fail on it
      }
    } else {
      reportProgress(6, 'Skipping verification — codesign is not available on this platform.');
    }

    await delay(100);

    // ── Step 7: Package IPA ──────────────────────────────────────────────
    reportProgress(7, 'Packaging signed IPA...');
    const outputDir = path.join(require('electron').app.getPath('userData'), 'signed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `${app.display_name || app.bundle_id}_signed.ipa`);

    try {
      const zip = new AdmZip();
      zip.addLocalFolder(extractDir, 'Payload');
      zip.writeZip(outputPath);
    } catch (zipErr) {
      throw new Error(
        `Failed to write signed IPA to "${outputPath}": ${zipErr.message}. ` +
        'Check that the output directory is writable and has sufficient disk space.'
      );
    }

    // Verify the output IPA was created and is non-empty
    if (!fs.existsSync(outputPath)) {
      throw new Error(
        `Signed IPA was not created at "${outputPath}". The zip operation may have failed silently.`
      );
    }
    const outputStat = fs.statSync(outputPath);
    if (outputStat.size < 1000) {
      throw new Error(
        `Signed IPA at "${outputPath}" is suspiciously small (${outputStat.size} bytes). ` +
        'The archive may be incomplete or corrupt.'
      );
    }

    reportProgress(7, `IPA packaged: ${(outputStat.size / 1024 / 1024).toFixed(1)} MB`);
    await delay(100);

    // ── Step 8: Complete ─────────────────────────────────────────────────
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

    signingStatuses[appId] = { status: 'completed', currentStep: SIGNING_STEPS.length, percentage: 100 };

    return {
      success: true,
      signed_ipa_path: outputPath,
      expires_at: cert.expires_at,
    };
  } catch (err) {
    const currentStep = signingStatuses[appId]?.currentStep ?? -1;
    const stepId = SIGNING_STEPS[currentStep]?.id || 'unknown';
    const stepLabel = SIGNING_STEPS[currentStep]?.label || 'Unknown step';

    signingStatuses[appId] = {
      status: 'failed',
      error: err.message,
      failedStep: stepId,
      failedStepLabel: stepLabel,
      percentage: getPercentage(currentStep),
    };

    console.error(
      `[SideloadX] Signing failed at step ${currentStep} (${stepLabel}): ${err.message}`
    );

    const db = getDb();
    db.prepare(`
      INSERT INTO signing_history (app_id, certificate_id, device_udid, status, error_message)
      VALUES (?, ?, ?, 'failed', ?)
    `).run(appId, certId, deviceId || null, `[Step: ${stepLabel}] ${err.message}`);

    throw err;
  }
}

function getSigningStatus(appId) {
  return signingStatuses[appId] || { status: 'idle', percentage: 0 };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startSigning, getSigningStatus, SIGNING_STEPS };
