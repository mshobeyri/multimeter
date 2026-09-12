'use strict';

const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function input(name) {
  const envName = `INPUT_${String(name).replace(/[\s.]/g, '_').toUpperCase()}`;
  return String(process.env[envName] || '').trim();
}

function isTrue(value) {
  return /^(true|1|yes)$/i.test(String(value || '').trim());
}

function fail(message) {
  console.error(message);
  console.log(`##vso[task.logissue type=error]${message}`);
  console.log(`##vso[task.complete result=Failed;]${message}`);
  process.exit(1);
}

function setOutput(name, value) {
  console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
}

function addPairs(args, flag, raw) {
  if (!raw) {
    return;
  }
  const pairs = raw.split(/\s+/).filter(Boolean);
  if (pairs.length) {
    args.push(flag, ...pairs);
  }
}

const file = input('file');
if (!file) {
  fail('Input "file" is required.');
}

const command = input('command') || 'run';
const envFile = input('envFile');
const preset = input('preset');
const env = input('env');
const inputVars = input('input');
const example = input('example');
const report = input('report');
const reportFile = input('reportFile');
const out = input('out');
const quiet = isTrue(input('quiet'));
const logLevel = input('logLevel');
const version = input('version') || 'latest';
const workingDirectory = input('workingDirectory') || process.cwd();

if (!fs.existsSync(workingDirectory)) {
  fail(`Working directory does not exist: ${workingDirectory}`);
}

if (reportFile) {
  fs.mkdirSync(path.dirname(path.resolve(workingDirectory, reportFile)), {recursive: true});
}
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(workingDirectory, out)), {recursive: true});
}

const spec = version === 'latest' ? 'mmt-testlight' : `mmt-testlight@${version}`;
const args = ['--yes', spec];
if (logLevel) {
  args.push('--log-level', logLevel);
}
args.push(command, file);
if (envFile) {
  args.push('--env-file', envFile);
}
if (preset) {
  args.push('--preset', preset);
}
addPairs(args, '-e', env);
addPairs(args, '-i', inputVars);
if (example) {
  args.push('--example', example);
}
if (report) {
  args.push('--report', report);
}
if (reportFile) {
  args.push('--report-file', reportFile);
}
if (out) {
  args.push('--out', out);
}
if (quiet) {
  args.push('--quiet');
}

console.log(`Running: npx ${args.join(' ')}`);
const result = spawnSync('npx', args, {
  cwd: workingDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.error) {
  fail(result.error.message);
}

const exitCode = result.status == null ? 1 : result.status;
setOutput('exitCode', String(exitCode));
if (out) {
  setOutput('result', out);
}
if (reportFile) {
  setOutput('report', reportFile);
}

if (exitCode !== 0) {
  fail(`testlight exited with code ${exitCode}`);
}
