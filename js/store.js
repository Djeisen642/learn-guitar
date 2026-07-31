// Progress lives entirely in localStorage — no account, no network.

const KEY = 'learn-guitar/v1';

const empty = () => ({ learned: {}, best: {}, streak: { count: 0, last: null } });

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private browsing / quota — progress just won't persist */
  }
}

export const isLearned = (id) => !!state.learned[id];

export function toggleLearned(id) {
  if (state.learned[id]) delete state.learned[id];
  else state.learned[id] = Date.now();
  save();
  return isLearned(id);
}

const pairKey = (a, b) => [a, b].sort().join('>');

export const bestChanges = (a, b) => state.best[pairKey(a, b)] || 0;

export function recordChanges(a, b, count) {
  const k = pairKey(a, b);
  if (count > (state.best[k] || 0)) {
    state.best[k] = count;
    save();
    return true;
  }
  return false;
}

/** Bump the practice streak. Returns the current count. */
export function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const { last, count } = state.streak;
  if (last === today) return count;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  state.streak = { count: last === yesterday ? count + 1 : 1, last: today };
  save();
  return state.streak.count;
}

export function streak() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (state.streak.last === today || state.streak.last === yesterday) return state.streak.count;
  return 0;
}

export const learnedCount = () => Object.keys(state.learned).length;

export function resetAll() {
  state = empty();
  save();
}
