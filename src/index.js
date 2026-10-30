/**
 * Extended Path Resolver — ESM entry point.
 *
 * Exposes the same small surface that `core.js` defines so consumers can do
 * `import { resolveExtended, splitStream } from 'extended-path-resolver'`
 * without reaching into internals.
 */
export { resolveExtended, splitStream } from './core.js';
