const forge = require('node-forge');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./database');

function addCertificate(p12Path, password) {
  try {
    // Read .p12 file
    const p12Buffer = fs.readFileSync(p12Path);
    const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Buffer.toString('base64')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password || '');

    // Extract certificate
    const certBags = p12.getBags({ bagType: forge.oids.certBag });
    const cert = certBags[forge.oids.certBag]?.[0]?.cert;

    if (!cert) {
      return { error: 'No certificate found in .p12 file' };
    }

    // Extract info
    const subject = cert.subject.getField('CN')?.value || 'Unknown';
    const issuer = cert.issuer.getField('OU')?.value || cert.issuer.getField('CN')?.value || '';
    const expiresAt = cert.validity.notAfter.toISOString();
    const serialNumber = cert.serialNumber;

    // Determine cert type
    let certType = 'paid';
    if (subject.includes('iPhone Distribution')) certType = 'enterprise';
    if (subject.includes('iPhone Developer')) certType = 'free';

    // Save to database
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO certificates (name, type, team_id, common_name, p12_path, p12_password, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(subject, certType, issuer, subject, p12Path, password, expiresAt);

    return {
      id: result.lastInsertRowid,
      name: subject,
      type: certType,
      team_id: issuer,
      expires_at: expiresAt,
    };
  } catch (err) {
    return { error: `Failed to parse certificate: ${err.message}` };
  }
}

function getAllCertificates() {
  return getDb().prepare('SELECT id, name, type, team_id, common_name, apple_id, expires_at, is_active, created_at FROM certificates ORDER BY created_at DESC').all();
}

function removeCertificate(id) {
  getDb().prepare('DELETE FROM certificates WHERE id = ?').run(id);
  return { success: true };
}

function getKeychainCertificates() {
  try {
    const output = execSync('security find-identity -v -p codesigning', { encoding: 'utf-8' });
    const certs = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*\d+\)\s+[A-F0-9]+\s+"([^"]+)"/);
      if (match) {
        certs.push({
          name: match[1],
          hash: line.match(/\s([A-F0-9]{40})\s/)?.[1] || '',
        });
      }
    }
    return certs;
  } catch (e) {
    return [];
  }
}

function getCertificateById(id) {
  return getDb().prepare('SELECT * FROM certificates WHERE id = ?').get(id);
}

module.exports = { addCertificate, getAllCertificates, removeCertificate, getKeychainCertificates, getCertificateById };
