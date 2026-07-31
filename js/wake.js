// Screen wake lock and the "stop when they look away" rule.
//
// Both are things every timed drill needs and none of them should have to think
// about, so they live here rather than being re-implemented per view.

let wakeLock = null;
let holders = 0;

/**
 * Timed drills are useless if the phone dims mid-count, so hold a screen wake
 * lock while one is running. Unsupported or denied browsers just carry on.
 *
 * Reference-counted: two drills can't exist at once today, but a view that
 * releases the lock while another still needs it is a bug that would only show
 * up as "the screen dims sometimes", which is nobody's idea of a good time.
 */
export async function keepAwake(on) {
  holders = Math.max(0, holders + (on ? 1 : -1));
  try {
    if (holders > 0) {
      if (!wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock) {
      const held = wakeLock;
      wakeLock = null;
      await held.release();
    }
  } catch {
    wakeLock = null; // denied or released by the system — not worth surfacing
  }
}

/**
 * Run `stop` if the user switches away, so metronomes don't burst on return.
 * Returns the unsubscribe function, for handing straight to `onLeave`.
 */
export function stopWhenHidden(stop) {
  const onHide = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onHide);
  return () => document.removeEventListener('visibilitychange', onHide);
}
