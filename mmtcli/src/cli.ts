#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { loadTestFile, summarize } from './loadTest.js';
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
        if (!opts.quiet) console.log(`Result written: ${outPath}`);
      }
      process.exit(result.success ? 0 : 1);
    } catch (e: any) {
      if (!opts.quiet) console.error('Error:', e?.message || e);
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
