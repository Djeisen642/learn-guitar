// Whatever a view starts, it registers here so navigating away reliably stops it.
//
// Views run timers, metronomes, wake locks and observers. Every one of those
// outlives the DOM it was drawn against unless something cancels it, so the
// router empties this registry before it renders anything else.

let teardown = [];

/** Register cleanup for the view currently being built. */
export const onLeave = (fn) => { teardown.push(fn); };

/** Run and clear every registered cleanup. Called by the router, once per route. */
export function runTeardown() {
  const pending = teardown;
  teardown = [];
  for (const fn of pending) {
    try {
      fn();
    } catch {
      // One view's broken cleanup must not strand the rest.
    }
  }
}
