// Browser-only storage (localStorage). Follow list, demo account and alerts never leave this browser.
export const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};
export const getFollows = () => store.get("follows", []);
export const isFollowed = (id) => getFollows().includes(id);
export function toggleFollow(id) {
  const f = getFollows();
  const i = f.indexOf(id);
  i >= 0 ? f.splice(i, 1) : f.push(id);
  store.set("follows", f);
}
