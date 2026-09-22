#!/usr/bin/env node
/**
 * Generates nested suite + test files for report spill / memory stress testing.
 * Run: node generate-stress-files.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LONG_PREFIX =
  'Memory stress probe — verify JSON payload fields, response headers, and timing metadata for suite report spill testing. Segment';

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function buildTestFile(name, index, stepCount = 24) {
  const lines = [
    'type: test',
    `title: ${yamlQuote(name)}`,
    `description: ${yamlQuote(`Stress test ${index} — many HTTP calls and verbose checks to inflate suite run reports`)}`,
    'steps:',
  ];

  for (let step = 1; step <= stepCount; step += 1) {
    const stepId = `s${step}`;
    const label = `${LONG_PREFIX} ${index}.${step} — GET json baseline`;
    lines.push(`  - http: https://test.mmt.dev/json`);
    lines.push(`    id: ${stepId}`);
    lines.push(`    title: ${yamlQuote(label)}`);
    lines.push('    method: get');
    lines.push('    expect:');
    lines.push('      status: 200');
    lines.push(`  - check: \${${stepId}.status} == 200`);
    lines.push(`    title: ${yamlQuote(`${label} — status code must remain 200 after suite routing and spill reload`)}`);
    lines.push(`  - check: \${${stepId}.body} != ""`);
    lines.push(`    title: ${yamlQuote(`${label} — response message body must be non-empty for report detail panels`)}`);
    lines.push(`  - check: \${${stepId}.headers} != ""`);
    lines.push(`    title: ${yamlQuote(`${label} — response headers must be present for report detail panels and spill reload`)}`);
  }

  lines.push('');
  return lines.join('\n');
}

function writeTest(dir, fileName, index, stepCount) {
  fs.mkdirSync(dir, { recursive: true });
  const base = fileName.replace(/\.mmt$/, '');
  fs.writeFileSync(path.join(dir, fileName), buildTestFile(base, index, stepCount), 'utf8');
}

function writeSuite(dir, fileName, { title, description, items }) {
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    'type: suite',
    `title: ${yamlQuote(title)}`,
    `description: ${yamlQuote(description)}`,
    'items:',
    ...items.map((item) => `  - ${item}`),
    '',
  ];
  fs.writeFileSync(path.join(dir, fileName), lines.join('\n'), 'utf8');
}

function rel(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function main() {
  const root = __dirname;
  let testIndex = 0;

  const makeTests = (dir, count, stepCount = 24) => {
    const files = [];
    for (let i = 1; i <= count; i += 1) {
      testIndex += 1;
      const fileName = `test_${pad(i)}.mmt`;
      writeTest(dir, fileName, testIndex, stepCount);
      files.push(fileName);
    }
    return files;
  };

  const alphaDir = path.join(root, 'branches', 'alpha', 'tests');
  const alphaTests = makeTests(alphaDir, 6, 28);
  writeSuite(path.join(root, 'branches', 'alpha'), 'suite.mmt', {
    title: 'Alpha branch',
    description: 'Six verbose tests in parallel — first nested suite under stage A',
    items: alphaTests.map((f) => `tests/${f}`),
  });

  const betaDir = path.join(root, 'branches', 'beta', 'tests');
  const betaTests = makeTests(betaDir, 6, 26);
  writeSuite(path.join(root, 'branches', 'beta'), 'suite.mmt', {
    title: 'Beta branch',
    description: 'Six verbose tests — second nested suite under stage A',
    items: betaTests.map((f) => `tests/${f}`),
  });

  const deepDir = path.join(root, 'branches', 'gamma', 'deep', 'tests');
  const deepTests = makeTests(deepDir, 5, 30);
  writeSuite(path.join(root, 'branches', 'gamma', 'deep'), 'suite.mmt', {
    title: 'Gamma deep suite',
    description: 'Deeper nesting — five heavy tests inside gamma/deep',
    items: deepTests.map((f) => `tests/${f}`),
  });

  const gammaShallowDir = path.join(root, 'branches', 'gamma', 'shallow', 'tests');
  const gammaShallowTests = makeTests(gammaShallowDir, 4, 22);
  writeSuite(path.join(root, 'branches', 'gamma', 'shallow'), 'suite.mmt', {
    title: 'Gamma shallow suite',
    description: 'Sibling nested suite under gamma',
    items: gammaShallowTests.map((f) => `tests/${f}`),
  });

  writeSuite(path.join(root, 'branches', 'gamma'), 'suite.mmt', {
    title: 'Gamma branch',
    description: 'Two nested suites — shallow and deep — run in parallel in stage B',
    items: ['shallow/suite.mmt', 'deep/suite.mmt'],
  });

  const deltaDir = path.join(root, 'leaf', 'tests');
  const deltaTests = makeTests(deltaDir, 8, 20);
  writeSuite(path.join(root, 'leaf'), 'suite.mmt', {
    title: 'Leaf suite',
    description: 'Eight tests without further nesting — final stage',
    items: deltaTests.map((f) => `tests/${f}`),
  });

  const alphaRel = rel(root, path.join(root, 'branches', 'alpha', 'suite.mmt'));
  const betaRel = rel(root, path.join(root, 'branches', 'beta', 'suite.mmt'));
  const gammaRel = rel(root, path.join(root, 'branches', 'gamma', 'suite.mmt'));
  const leafRel = rel(root, path.join(root, 'leaf', 'suite.mmt'));

  writeSuite(root, 'suite.mmt', {
    title: 'Suite memory stress',
    description: 'Large nested suite for report spill and UI memory testing against test.mmt.dev',
    items: [
      alphaRel,
      betaRel,
      'then',
      gammaRel,
      'then',
      leafRel,
    ],
  });

  console.log(`Generated ${testIndex} stress tests under ${root}`);
}

main();
