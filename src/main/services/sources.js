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

async function fetchSourceApps(sourceId) {
  // In production, this would fetch from the source URL
  // For now, return placeholder data
  const source = getDb().prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  if (!source) return { error: 'Source not found' };

  // Placeholder: in real implementation, fetch JSON from source URL
  // and parse app list
  return {
    source: source.name,
    apps: [],
    message: 'Source fetching not yet implemented - connect to a real source URL',
  };
}

module.exports = { getAllSources, addSource, removeSource, fetchSourceApps };
