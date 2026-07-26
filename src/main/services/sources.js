const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getDb } = require('./database');

// Built-in default sources
const DEFAULT_SOURCES = [
  {
    name: 'AltStore Source',
    url: 'https://apps.altstore.io',
    enabled: 1,
  },
  {
    name: 'SideStore Source',
    url: 'https://apps.sidestore.io',
    enabled: 1,
  },
];

function initDefaultSources() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as count FROM sources').get();
  if (count.count === 0) {
    for (const source of DEFAULT_SOURCES) {
      db.prepare('INSERT OR IGNORE INTO sources (name, url, enabled) VALUES (?, ?, ?)').run(
        source.name, source.url, source.enabled
      );
    }
  }
}

function getAllSources() {
  initDefaultSources();
  return getDb().prepare('SELECT * FROM sources ORDER BY name').all();
}

function addSource(name, url) {
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO sources (name, url) VALUES (?, ?)').run(name, url);
    return { id: result.lastInsertRowid, name, url };
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return { error: 'Source URL already exists' };
    }
    throw err;
  }
}

function removeSource(id) {
  getDb().prepare('DELETE FROM sources WHERE id = ?').run(id);
  return { success: true };
}

/**
 * In-memory cache of fetched apps keyed by source ID.
 * Each entry: { source: string, apps: Array, fetchedAt: string }
 */
const appCache = {};

/**
 * Fetches a URL using Node.js native http/https modules with a timeout.
 * Resolves with the full response body as a string.
 */
function fetchUrl(urlString, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.get(parsed, { timeout: timeoutMs }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} from ${urlString}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms: ${urlString}`));
    });

    req.on('error', reject);
  });
}

/**
 * Normalises a raw app object from the AltStore/Source JSON format
 * into a consistent shape. Unknown fields are carried through so
 * nothing is silently dropped.
 */
function normaliseApp(raw) {
  return {
    name: raw.name || '',
    bundleIdentifier: raw.bundleIdentifier || '',
    version: raw.version || '',
    versionDate: raw.versionDate || '',
    size: typeof raw.size === 'number' ? raw.size : 0,
    downloadURL: raw.downloadURL || '',
    developerName: raw.developerName || '',
    localizedDescription: raw.localizedDescription || '',
    iconURL: raw.iconURL || '',
    screenshotURLs: Array.isArray(raw.screenshotURLs) ? raw.screenshotURLs : [],
    tintColor: raw.tintColor || '',
    // carry through any extra fields the source may provide
    ...raw,
  };
}

/**
 * Fetches apps from a source URL and caches the result in memory.
 * Returns { source, apps, message } on success, or { error } on failure.
 */
async function fetchSourceApps(sourceId) {
  const source = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  if (!source) return { error: 'Source not found' };

  let body;
  try {
    body = await fetchUrl(source.url);
  } catch (err) {
    return { error: `Network error: ${err.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return { error: `Invalid JSON from source: ${err.message}` };
  }

  const rawApps = Array.isArray(parsed.apps) ? parsed.apps : [];
  const apps = rawApps.map(normaliseApp);

  // Determine the source name: prefer what we stored in the DB,
  // fall back to the JSON payload's own name.
  const sourceName = source.name || parsed.name || 'Unknown';

  // Update the in-memory cache
  const now = new Date().toISOString();
  appCache[sourceId] = {
    source: sourceName,
    apps,
    fetchedAt: now,
  };

  // Persist the fetch timestamp in the database
  try {
    getDb().prepare('UPDATE sources SET last_fetched = ? WHERE id = ?').run(now, sourceId);
  } catch (_) {
    // Non-fatal — we still return the data even if the timestamp write fails
  }

  return {
    source: sourceName,
    apps,
    message: `${apps.length} apps found`,
  };
}

/**
 * Returns the last-fetched app list for a source from the in-memory cache.
 * Returns null if nothing has been fetched yet for this source.
 */
function getSourceApps(sourceId) {
  return appCache[sourceId] || null;
}

module.exports = { getAllSources, addSource, removeSource, fetchSourceApps, getSourceApps };
