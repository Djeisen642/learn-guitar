// Progress lives entirely in localStorage — no account, no network.
//
// Each kind of record gets its own bag. They used to share two: change scores
// and formation times were both in `best`, told apart by a `form:` prefix and
// by one being "higher is better" while the other is "lower is better"; the
// practice tempo lived in `flags` next to the booleans, where reading it with
// getFlag would have said `true` and writing it with setFlag would have wiped
// it. Nothing collided in practice, but only because nobody had added the wrong
// key yet.

const KEY = 'learn-guitar/v1';

const empty = () => ({
  learned: {},              // chord id -> when it was marked learned
  changes: {},              // "A>B" -> best changes in a minute (higher is better)
  forms: {},                // chord id -> fastest clean formation in ms (lower is better)
  streak: { count: 0, last: null },
  flags: {},                // booleans: has the rotate tip been seen, etc.
  settings: {},             // values: practice tempo, etc.
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

/**
 * Bring a saved shape up to date, in place. Progress people already earned is
 * worth keeping, so old records are moved rather than dropped.
 *
 * @returns {boolean} whether anything actually moved
 */
function migrate(saved) {
  let changed = false;

  // `best` held change scores keyed "A>B" and formation times keyed "form:id".
  for (const [k, v] of Object.entries(saved.best || {})) {
    if (k.startsWith('form:')) saved.forms[k.slice(5)] ??= v;
    else saved.changes[k] ??= v;
    changed = true;
  }
  if (saved.best) {
    delete saved.best;
    changed = true;
  }

  // Flags were boolean-only by convention; anything else was really a setting.
  for (const [k, v] of Object.entries(saved.flags)) {
    if (typeof v === 'boolean') continue;
    saved.settings[k] ??= v;
    delete saved.flags[k];
    changed = true;
  }
  return changed;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private browsing / quota — progress just won't persist */
  }
}

let state = load();
// Written back once, so an old shape doesn't sit there being re-migrated on
// every load for the rest of the device's life.
if (migrate(state)) save();

// --- learned chords --------------------------------------------------------

export const isLearned = (id) => !!state.learned[id];

export const learnedCount = () => Object.keys(state.learned).length;

export function toggleLearned(id) {
  if (state.learned[id]) delete state.learned[id];
  else state.learned[id] = Date.now();
  save();
  return isLearned(id);
}

// --- one-minute changes: how many, so higher wins --------------------------

const pairKey = (a, b) => [a, b].sort().join('>');

export const bestChanges = (a, b) => state.changes[pairKey(a, b)] || 0;

export function recordChanges(a, b, count) {
  const k = pairKey(a, b);
  if (count <= (state.changes[k] || 0)) return false;
  state.changes[k] = count;
  save();
  return true;
}

// --- forming a shape: how long, so lower wins ------------------------------

/** Fastest clean formation of a chord shape, in milliseconds. 0 when unset. */
export const bestForm = (id) => state.forms[id] || 0;

export function recordForm(id, ms) {
  if (state.forms[id] && ms >= state.forms[id]) return false;
  state.forms[id] = ms;
  save();
  return true;
}

// --- practice streak -------------------------------------------------------

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

/** Bump the practice streak. Returns the current count. */
export function touchStreak() {
  const today = day();
  const { last, count } = state.streak;
  if (last === today) return count;
  state.streak = { count: last === day(1) ? count + 1 : 1, last: today };
  save();
  return state.streak.count;
}

export function streak() {
  const { last, count } = state.streak;
  return last === day() || last === day(1) ? count : 0;
}

// --- flags and settings ----------------------------------------------------

/** One-off yes/no flags, e.g. "they've seen the rotation tip". */
export const getFlag = (name) => !!state.flags[name];

export function setFlag(name, on = true) {
  state.flags[name] = !!on;
  save();
}

/** Settings that hold a value rather than a yes/no, e.g. the practice tempo. */
export const getSetting = (name, fallback = null) => state.settings[name] ?? fallback;

export function setSetting(name, value) {
  state.settings[name] = value;
  save();
}

export function resetAll() {
  state = empty();
  save();
}
