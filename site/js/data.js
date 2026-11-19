// Reads the published data files (site/data/*). Province files are loaded on demand and cached.
const getJSON = (url) => fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); });

let metaP = null;
const shards = new Map();

export const loadMeta = () => (metaP ??= getJSON("data/meta.json"));
export const loadStatus = () => getJSON("data/status.json").catch(() => null);

export function loadProvince(name) {
  if (!shards.has(name)) shards.set(name, getJSON(`data/provinces/${encodeURIComponent(name)}.json`).then((d) => d.items));
  return shards.get(name);
}
export async function loadMany(names) {
  return (await Promise.all(names.map(loadProvince))).flat();
}
export const loadAll = async () => loadMany((await loadMeta()).provinces.map((p) => p.name));
export const dataAgeDays = (meta) => (meta.updated ? Math.floor((Date.now() - Date.parse(meta.updated)) / 864e5) : null);
