'use strict';

const {
  normalizeUserPath,
  resolveUserPath,
} = require('../src/pathNormalize.cjs');
const path = require('path');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Drive-letter forms
assertEqual(normalizeUserPath('c:\\foo\\bar'), 'C:\\foo\\bar', 'c:\\\\');
assertEqual(normalizeUserPath('c:/foo/bar'), 'C:\\foo\\bar', 'c:/');
assertEqual(normalizeUserPath('C://foo//bar'), 'C:\\foo\\bar', 'C://');
assertEqual(normalizeUserPath('c:\\\\foo\\\\bar'), 'C:\\foo\\bar', 'c:\\\\\\\\');
assertEqual(normalizeUserPath('c:foo'), 'C:\\foo', 'c:foo');
assertEqual(normalizeUserPath('d:\\'), 'D:\\', 'd:\\');

// Mixed + duplicate separators
assertEqual(normalizeUserPath('foo\\\\bar//baz'), 'foo\\bar\\baz', 'mixed relative');
assertEqual(normalizeUserPath('\\\\server\\share\\a'), '\\\\server\\share\\a', 'unc');
assertEqual(normalizeUserPath('//server/share/a'), '\\\\server\\share\\a', 'unc //');

// Quotes
assertEqual(normalizeUserPath('"C:\\temp\\a.mmt"'), 'C:\\temp\\a.mmt', 'quoted');

// Resolve
const base = 'C:\\projects\\demo';
assertEqual(
  resolveUserPath('examples\\a.mmt', base, path.win32),
  'C:\\projects\\demo\\examples\\a.mmt',
  'resolve relative',
);
assertEqual(
  resolveUserPath('c:/examples/a.mmt', base, path.win32),
  'C:\\examples\\a.mmt',
  'resolve absolute drive',
);
assertEqual(
  resolveUserPath('C:\\\\examples\\\\a.mmt', base, path.win32),
  'C:\\examples\\a.mmt',
  'resolve absolute double backslash',
);

console.log('pathNormalize.cjs: ok');
