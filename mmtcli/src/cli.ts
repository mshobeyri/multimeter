#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadTestFile, summarize, maybeGenerateJs } from './loadTest.js';
import { JSer, testParsePack } from 'mmt-core';
import yaml from 'js-yaml';
import { runTestObject } from './runTest.js';

const program = new Command();

program
  .name('multimeter')
  .description('Multimeter CLI runner')
  .version('0.1.0');

program
  .command('run')
  .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
  .option('-q, --quiet', 'Minimal output', false)
  .option('-o, --out <file>', 'Write result JSON to file')
  .action(async (file: string, opts: { quiet?: boolean; out?: string }) => {
    try {
      const raw = loadTestFile(file);
      const summary = summarize(raw);
  if (!opts.quiet) {
        console.log(`Loaded: ${path.resolve(file)} (${summary})`);
      }
      const result = await runTestObject(raw);
      if (!opts.quiet) {
        console.log(`Success: ${result.success}`);
        console.log(`Duration: ${result.durationMs.toFixed(2)} ms`);
        if (result.errors.length) {
          console.log('Errors:');
          result.errors.forEach(e => console.log(' -', e));
        }
      }
      if (opts.out) {
        const outPath = path.resolve(opts.out);
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
        if (!opts.quiet) {
          console.log(`Result written: ${outPath}`);
        }
      }
      process.exit(result.success ? 0 : 1);
    } catch (e: any) {
      if (!opts.quiet) {
        console.error('Error:', e?.message || e);
      }
      process.exit(2);
    }
  });

program
  .command('to-js')
  .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
  .description('Convert a test definition file to executable JS using JSer and print to stdout')
  .option('-s, --stages', 'Include stage headers as comments when stages exist', true)
  .action(async (file: string, opts: { stages?: boolean }) => {
    try {
      const full = path.resolve(process.cwd(), file);
      const dir = path.dirname(full);
      const rawText = fs.readFileSync(full, 'utf8');
      const raw = /\.json$/i.test(full) ? JSON.parse(rawText) : yaml.load(rawText);

      // Custom file loader resolving relative to test file directory
      JSer.setFileLoader(async (p: string) => {
        const rel = path.isAbsolute(p) ? p : path.join(dir, p);
        if (!fs.existsSync(rel)) { return ''; }
        return fs.readFileSync(rel, 'utf8');
      });

      const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : raw; // fallback
      const js = await JSer.rootTestToJsfunc({
        test,
        name: path.basename(full).replace(/[^a-zA-Z0-9_]/g, '_'),
        inputs: {},
        envVars: {}
      });
      if (!js.trim()) {
        console.error('No JS could be generated (empty flow).');
        process.exit(1);
      }
      console.log(js.trim());
    } catch (e: any) {
      console.error('Error generating JS:', e?.message || e);
      process.exit(2);
    }
  });

program
  .command('version-info')
  .description('Show environment info')
  .action(() => {
    console.log('multimeter cli 0.1.0');
    console.log('Node:', process.version);
  });

program.parseAsync(process.argv);
