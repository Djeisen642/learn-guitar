// The one element helper.
//
// There used to be two of these — one in app.js, one in fretboard.js — and they
// had already drifted apart. Copying markup from one file to the other quietly
// changed what it meant, which is exactly the kind of bug nobody goes looking
// for. There is one now.

/**
 * Build an element.
 *
 *   h('button', { class: 'btn', onclick: fn, disabled: true }, 'Go')
 *
 * Props: `class` sets className, `on*` adds a listener, `true` sets a bare
 * attribute, `false`/`null`/`undefined` sets nothing, anything else becomes an
 * attribute. Children may be strings, nodes, arrays, or null to skip.
 */
export function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}

/** Replace an element's contents in one go. */
export function fill(node, ...kids) {
  node.textContent = '';
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}
