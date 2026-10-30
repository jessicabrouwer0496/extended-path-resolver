import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveExtended, splitStream } from '../src/index.js';

test('resolveExtended matches path.resolve on plain paths', () => {
  const plain = path.join('a', 'b', 'c.txt');
  assert.equal(resolveExtended(plain), path.resolve(plain));
});

test('resolveExtended preserves a trailing dot in the final segment', () => {
  const input = path.join('dir', 'file.txt.');
  const result = resolveExtended(input);
  assert.ok(result.endsWith('file.txt.'), `got ${result}`);
});

test('resolveExtended preserves trailing dots in an interior segment', () => {
  // POSIX keeps these; win32 would strip them — we want them kept on both.
  const input = path.join('dir.', 'sub.', 'file.txt');
  const result = resolveExtended(input);
  assert.ok(result.includes('dir.'), `got ${result}`);
  assert.ok(result.includes('sub.'), `got ${result}`);
});

test('resolveExtended preserves a trailing space in the final segment', () => {
  const input = path.join('dir', 'file.txt ');
  const result = resolveExtended(input);
  assert.ok(result.endsWith('file.txt '), `got ${result}`);
});

test('resolveExtended preserves both a trailing dot and a trailing space', () => {
  const input = path.join('dir', 'file.txt. ');
  const result = resolveExtended(input);
  assert.ok(result.endsWith('file.txt. '), `got ${result}`);
});

test('splitStream returns empty stream for a plain path', () => {
  const [p, s] = splitStream(path.join('a', 'b', 'c.txt'));
  assert.equal(s, '');
  assert.equal(p, path.join('a', 'b', 'c.txt'));
});

test('splitStream peels a simple ADS suffix off the final segment', () => {
  const [p, s] = splitStream(path.join('dir', 'file.txt:ads'));
  assert.equal(s, ':ads');
  assert.equal(p, path.join('dir', 'file.txt'));
});

test('splitStream handles the full :stream:$DATA form', () => {
  const [p, s] = splitStream('file.txt:stream:$DATA');
  assert.equal(s, ':stream:$DATA');
  assert.equal(p, 'file.txt');
});

test('resolveExtended re-attaches an ADS suffix after resolving', () => {
  const input = path.join('dir', 'file.txt:ads');
  const result = resolveExtended(input);
  assert.ok(result.endsWith(':ads'), `got ${result}`);
  assert.ok(result.includes('file.txt'), `got ${result}`);
});

test('resolveExtended preserves trailing dots AND re-attaches an ADS suffix', () => {
  const input = path.join('dir', 'file.txt.:ads');
  const result = resolveExtended(input);
  assert.ok(result.endsWith('file.txt.:ads'), `got ${result}`);
});

test('resolveExtended with no arguments behaves like path.resolve()', () => {
  assert.equal(resolveExtended(), path.resolve());
});

test('resolveExtended handles multiple segments with a trailing dot', () => {
  const result = resolveExtended('a', 'b', 'file.txt.');
  assert.ok(result.endsWith('file.txt.'), `got ${result}`);
});
