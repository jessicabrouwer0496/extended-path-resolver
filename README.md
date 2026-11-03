# extended-path-resolver

Resolves filesystem paths while preserving trailing dots, trailing spaces, and NTFS alternate-data-stream suffixes that Node's `path.resolve` silently destroys or chokes on.

```js
import { resolveExtended, splitStream } from 'extended-path-resolver';

resolveExtended('dir/file.txt.');        // keeps the trailing dot
resolveExtended('dir/file.txt:ads');     // keeps the ADS suffix
splitStream('dir/file.txt:stream:$DATA'); // -> ['dir/file.txt', ':stream:$DATA']
```

## Why this exists

Node's `path.resolve` delegates to the platform's path normalisation. On Windows that normalisation follows Win32 rules, which strip trailing dots and trailing spaces from each segment and reject the colons used by NTFS alternate data streams. On POSIX the behaviour is different but still surprising when you need to round-trip a Windows-style name. If you are building tooling that must address files by their exact on-disk name across platforms, the built-in module is not enough.

This library resolves the path string only — it does not touch the filesystem. It works by swapping the fragile characters (`.`, ` `, and the ADS colon) for private-use Unicode placeholders before calling `path.resolve`, then restoring them afterward. The ADS suffix is split off first so the colon never reaches the resolver.

## Edge you will hit

The placeholder characters come from Unicode's private-use area (`U+E000`, `U+E001`). They are illegal in real filenames on every common filesystem, which is exactly why they are safe to use as temporary stand-ins. If your upstream code has already stripped a trailing dot before the string reaches this library, there is nothing to restore — call it as close to the source of the path as possible.

Only the *final* segment is inspected for an ADS suffix. A colon in a directory component is a genuine path error and is left for `path.resolve` to reject as it normally would.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

