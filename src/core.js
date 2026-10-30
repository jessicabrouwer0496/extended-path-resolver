/**
 * Extended path resolution that copes with three things Node's built-in
 * `path.resolve` silently destroys:
 *
 * 1. Trailing dots on path segments. Windows Shell and some legacy tools treat
 *    `file.txt.` and `file.txt` as distinct names, but Win32 path normalisation
 *    (and therefore Node's `path` on win32) strips trailing dots. We preserve
 *    them by substituting a placeholder before resolving and restoring it after.
 *
 * 2. Trailing spaces in the final segment. Same story: Win32 strips them, POSIX
 *    keeps them. We treat them the same way as dots — preserve, resolve, restore.
 *
 * 3. NTFS alternate data stream suffixes of the form `file.ext:stream:$DATA`.
 *    `path.resolve` throws on the colon. We split the stream off, resolve the
 *    path portion, then re-attach the stream untouched.
 *
 * The trade-off: this only handles the *path string*. It does not touch the
 * filesystem, so it will not catch a dot that was already stripped by an
 * upstream tool before the string reached you. Use it as close to the source
 * as possible.
 */

import path from 'node:path';

// Characters we must never let `path.resolve` see, and the placeholders we
// swap them for. The placeholders are chosen to be path-safe on both POSIX and
// win32 so the resolve step is a no-op on the substituted portion.
const DOT = '.';
const SPACE = ' ';
const DOT_PLACEHOLDER = '\uE000'; // private-use unicode, illegal in real names
const SPACE_PLACEHOLDER = '\uE001';

/**
 * Pull an NTFS alternate-data-stream suffix off the end of a path.
 *
 * Returns `[pathPart, streamPart]` where `streamPart` is everything from the
 * first colon in the final segment onward (including the colon), or the empty
 * string if there is no stream. Only the *final* segment is inspected — a colon
 * in a directory component is a genuine path error we do not want to mask.
 *
 * Examples:
 *   splitStream('C:\\dir\\file.txt:ads')   -> ['C:\\dir\\file.txt', ':ads']
 *   splitStream('file.txt:stream:$DATA')    -> ['file.txt', ':stream:$DATA']
 *   splitStream('/usr/bin/file')            -> ['/usr/bin/file', '']
 *
 * @param {string} input
 * @returns {[string, string]}
 */
export function splitStream(input) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  const base = path.basename(input);
  const colon = base.indexOf(':');
  if (colon === -1) {
    return [input, ''];
  }
  const dir = path.dirname(input);
  const stream = base.slice(colon);
  const pathPart = path.join(dir, base.slice(0, colon));
  return [pathPart, stream];
}

/**
 * Resolve a path while preserving trailing dots and trailing spaces in every
 * segment, and re-attach any NTFS alternate data stream suffix afterward.
 *
 * Mirrors `path.resolve(...segments)` for the signature so it can be a drop-in
 * replacement, but the preservation behaviour is the point.
 *
 * @param {...string} segments
 * @returns {string}
 */
export function resolveExtended(...segments) {
  if (segments.length === 0) {
    return path.resolve();
  }

  // Step 1: peel the ADS off the *last* segment only. A colon in an earlier
  // segment is a real error in the path and we let `path.resolve` complain.
  const last = String(segments[segments.length - 1]);
  const [pathPartOfLast, stream] = splitStream(last);
  const adjustedSegments = segments.slice(0, -1).map(String);
  adjustedSegments.push(pathPartOfLast);

  // Step 2: swap the fragile characters for placeholders across the whole
  // path string. We operate on the joined string rather than per-segment so
  // that a dot or space that happens to sit *between* segments (e.g. a
  // trailing space on one segment and a leading dot on the next) is still
  // preserved.
  const joined = adjustedSegments.join(path.sep);
  const masked = joined
    .replaceAll(DOT, DOT_PLACEHOLDER)
    .replaceAll(SPACE, SPACE_PLACEHOLDER);

  // Step 3: split back into segments on the separator and resolve.
  const maskedSegments = masked.split(path.sep);
  const resolved = path.resolve(...maskedSegments);

  // Step 4: restore the real characters and re-attach the stream.
  const restored = resolved
    .replaceAll(DOT_PLACEHOLDER, DOT)
    .replaceAll(SPACE_PLACEHOLDER, SPACE);

  return stream ? restored + stream : restored;
}
