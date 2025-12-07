import fs from 'fs';
import path from 'path';

const DATA_ROOT = path.join(process.cwd(), 'data');
const TARGET_DIRS = ['financials', 'transcripts'];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached = { timestamp: 0, value: null };

async function findLatestMtime(dirPath) {
  let latest = 0;
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const childLatest = await findLatestMtime(fullPath);
      latest = Math.max(latest, childLatest);
    } else {
      const stat = await fs.promises.stat(fullPath);
      latest = Math.max(latest, stat.mtimeMs);
    }
  }

  return latest;
}

export async function getDataFreshness() {
  const now = Date.now();
  if (cached.value && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const freshness = {};

  for (const dir of TARGET_DIRS) {
    const full = path.join(DATA_ROOT, dir);
    const exists = fs.existsSync(full);
    if (!exists) continue;
    const latestMs = await findLatestMtime(full);
    freshness[dir] = latestMs || null;
  }

  const latestAcross = Math.max(...Object.values(freshness).filter(Boolean), 0);
  const latestDate = latestAcross ? new Date(latestAcross) : null;

  const value = {
    ...freshness,
    latest: latestAcross,
    latestHuman: latestDate ? latestDate.toISOString().split('T')[0] : null
  };

  cached = { timestamp: now, value };
  return value;
}
