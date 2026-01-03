// CommonJS entrypoint for pkg.
//
// This file is executed by pkg's CJS loader. To avoid ESM/CJS interop issues
// (and snapshot path quirks), we implement a minimal CLI here.

const fs = require('fs');

function createPkgJsRunner() {
	// In pkg, `mmt-core` resolves to the workspace path (`/snapshot/mmt/core/dist/index.js`).
	// But `mmt-core/jsRunner` may fail because it tries `/snapshot/mmt/node_modules/...`.
	// Load jsRunner relative to the resolved core dist entry instead.
	// Infrastructure reality with pkg:
	// - `require('mmt-core')` works (pkg bundles it as workspace `/snapshot/mmt/core/...`).
	// - `require('mmt-core/jsRunner')` fails because pkg expects `/snapshot/mmt/node_modules/...`.
	// To avoid brittle snapshot paths, implement the minimal `runJSCode` here.

	// eslint-disable-next-line global-require
	const mmtCore = require('mmt-core');
	const networkCore = mmtCore.networkCore;
	const outputExtractor = mmtCore.outputExtractor;
	const Random = mmtCore.Random;
	const testHelper = mmtCore.testHelper;

	if (!networkCore || !outputExtractor || !Random || !testHelper) {
		return {
			runJSCode: async ({ title, logger }) => {
				logger('error', 'Packaged runner missing required mmt-core modules (networkCore/outputExtractor/Random/testHelper).');
				logger('error', 'Fix: export these from `core/src/index.ts`, or avoid pkg for this build.');
				throw new Error('Internal error: packaged JS runner is incomplete');
			},
		};
	}

	return {
		runJSCode: async ({ code, title, logger }) => {
			const startTime = Date.now();
			const customConsole = {
				trace: (...args) => logger('trace', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				debug: (...args) => logger('debug', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				log: (...args) => logger('info', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				warn: (...args) => logger('warn', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				error: (...args) => logger('error', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
			};
			try {
				const helperDecls = Object.keys(testHelper)
					.map((name) => `const ${name} = testHelper[\"${name}\"];`)
					.join('\n');
				const randomDecls = Object.keys(Random)
					.filter((name) => typeof Random[name] === 'function')
					.map((name) => `const ${name} = Random[\"${name}\"];`)
					.join('\n');
				const fn = new Function(
					'testHelper',
					'console',
					'send',
					'extractOutputs',
					'Random',
					`${helperDecls}\n${randomDecls}\n${code}`,
				);
				await fn(
					testHelper,
					customConsole,
					networkCore.send,
					outputExtractor.extractOutputs,
					Random,
				);
			} finally {
				const elapsed = Date.now() - startTime;
				logger('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
			}
		},
		setRunnerNetworkConfig: networkCore.setRunnerNetworkConfig,
	};
}

function printHelp() {
	const out = [
		'Usage: testlight [options] <command>',
		'',
		'Commands:',
		'  run <file>      Run a .mmt file',
		'  print-js <file> Print generated JS for a test',
		'  debug-resolve   Print pkg module resolution info',
		'',
		'Options:',
		'  -h, --help      Show help',
		'  -v, --version   Show version',
		'  --log-level <level>  Set log level (error|warn|info|debug|trace)',
	].join('\n');
	process.stdout.write(out + '\n');
}

function printRunHelp() {
	const out = [
		'Usage: testlight run [options] <file>',
		'',
		'Run a .mmt file',
		'',
		'Options:',
		'  -h, --help             Show help for run',
		'  -q, --quiet            Minimal output',
		'  -o, --out <file>       Write result JSON to file',
		'  -i, --input <k=v...>    Input variables (repeatable; key=val or key val)',
		'  -e, --env <k=v...>      Env variables (repeatable; key=val or key val)',
		'  --env-file <path>       Env file (.mmt/.yaml) to read variables from',
		'  --preset <name>         Preset name from env file (e.g. runner.dev)',
		'  --example <name|#n>     Run a named example or index (#1 is first)',
		'  --print-js              Print generated JS before executing',
		'  --debug-env             Print resolved env vars (debug)',
		'  --log-level <level>    Set log level (error|warn|info|debug|trace)',
	].join('\n');
	process.stdout.write(out + '\n');
}

function printPrintJsHelp() {
	const out = [
		'Usage: testlight print-js [options] <file>',
		'',
		'Convert a test definition file to executable JS and print to stdout',
		'',
		'Options:',
		'  -h, --help             Show help for print-js',
		'  -i, --input <k=v...>    Input variables (repeatable; key=val or key val)',
		'  -e, --env <k=v...>      Env variables (repeatable; key=val or key val)',
		'  --env-file <path>       Env file (.mmt/.yaml) to read variables from',
		'  --preset <name>         Preset name from env file (e.g. runner.dev)',
		'  --example <name|#n>     Select example before JS generation',
	].join('\n');
	process.stdout.write(out + '\n');
}

function coerceCliValue(v) {
	const t = String(v ?? '').trim();
	if (/^(true|false)$/i.test(t)) {
		return /^true$/i.test(t);
	}
	if (/^[-+]?\d+$/.test(t)) {
		return Number(t);
	}
	if (/^[-+]?\d*\.\d+$/.test(t)) {
		return Number(t);
	}
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		return t.slice(1, -1);
	}
	return t;
}

function parsePairs(tokens) {
	const out = {};
	const arr = Array.isArray(tokens) ? tokens : [];
	for (let i = 0; i < arr.length; i++) {
		const token = String(arr[i] ?? '');
		const eq = token.indexOf('=');
		if (eq > 0) {
			const k = token.slice(0, eq).trim();
			const v = token.slice(eq + 1);
			if (k) {
				out[k] = coerceCliValue(v);
			}
		} else if (i + 1 < arr.length) {
			const k = token.trim();
			const v = arr[++i];
			if (k) {
				out[k] = coerceCliValue(v);
			}
		}
	}
	return out;
}

function loadEnvDoc(envPath) {
	try {
		// eslint-disable-next-line global-require
		const yaml = require('js-yaml');
		const txt = fs.readFileSync(envPath, 'utf8');
		const data = yaml.load(txt);
		if (!data || typeof data !== 'object') {
			return {};
		}
		if (data.type && String(data.type) !== 'env') {
			return {};
		}
		return { variables: data.variables || {}, presets: data.presets || {} };
	} catch {
		return {};
	}
}

function parseExampleFlag(raw) {
	if (typeof raw !== 'string' || !raw.trim()) {
		return { exampleIndex: undefined, exampleName: undefined };
	}
	const trimmed = raw.trim();
	const numeric = trimmed.match(/^#?(\d+)$/);
	if (numeric) {
		const parsed = Number(numeric[1]);
		return { exampleIndex: parsed > 0 ? parsed - 1 : 0, exampleName: undefined };
	}
	return { exampleIndex: undefined, exampleName: trimmed };
}

function parseRunArgv(argv) {
	// argv includes: ['run', ...]
	const opts = {
		input: [],
		env: [],
		envFile: undefined,
		preset: undefined,
		example: undefined,
		printJs: false,
		debugEnv: false,
		quiet: false,
		out: undefined,
		logLevel: parseLogLevel(argv),
	};
	const consumed = new Set();
	const consume = (i) => { consumed.add(i); };
	for (let i = 1; i < argv.length; i++) {
		if (consumed.has(i)) {
			continue;
		}
		const a = argv[i];
		if (!a) {
			continue;
		}
		if (a === '-h' || a === '--help') {
			continue;
		}
		if (a === '--log-level') {
			consume(i + 1);
			i += 1;
			continue;
		}
		if (a === '-q' || a === '--quiet') {
			opts.quiet = true;
			continue;
		}
		if (a === '-o' || a === '--out') {
			consume(i + 1);
			opts.out = argv[++i];
			continue;
		}
		if (a === '--print-js') {
			opts.printJs = true;
			continue;
		}
		if (a === '--debug-env') {
			opts.debugEnv = true;
			continue;
		}
		if (a === '-i' || a === '--input') {
			// Collect one or two tokens (key=val OR key val). Repeatable.
			consume(i + 1);
			const first = argv[++i];
			if (first != null) {
				opts.input.push(first);
				if (!String(first).includes('=') && i + 1 < argv.length && !String(argv[i + 1]).startsWith('-')) {
					consume(i + 1);
					opts.input.push(argv[++i]);
				}
			}
			continue;
		}
		if (a === '-e' || a === '--env') {
			consume(i + 1);
			const first = argv[++i];
			if (first != null) {
				opts.env.push(first);
				if (!String(first).includes('=') && i + 1 < argv.length && !String(argv[i + 1]).startsWith('-')) {
					consume(i + 1);
					opts.env.push(argv[++i]);
				}
			}
			continue;
		}
		if (a === '--env-file') {
			consume(i + 1);
			opts.envFile = argv[++i];
			continue;
		}
		if (a === '--preset') {
			consume(i + 1);
			opts.preset = argv[++i];
			continue;
		}
		if (a === '--example') {
			consume(i + 1);
			opts.example = argv[++i];
			continue;
		}
		if (String(a).startsWith('-')) {
			// Unknown flag; ignore for now.
			continue;
		}
	}
	let filePath;
	for (let i = 1; i < argv.length; i++) {
		if (consumed.has(i)) {
			continue;
		}
		const a = argv[i];
		if (!a) {
			continue;
		}
		if (String(a).startsWith('-')) {
			continue;
		}
		filePath = a;
		break;
	}
	return { filePath, opts };
}

function parsePrintJsArgv(argv) {
	// argv includes: ['print-js', ...]
	const opts = {
		input: [],
		env: [],
		envFile: undefined,
		preset: undefined,
		example: undefined,
	};
	let filePath;
	for (let i = 1; i < argv.length; i++) {
		const a = argv[i];
		if (!a) {
			continue;
		}
		if (a === '-h' || a === '--help') {
			continue;
		}
		if (a === '-i' || a === '--input') {
			const first = argv[++i];
			if (first != null) {
				opts.input.push(first);
				if (!String(first).includes('=') && i + 1 < argv.length && !String(argv[i + 1]).startsWith('-')) {
					opts.input.push(argv[++i]);
				}
			}
			continue;
		}
		if (a === '-e' || a === '--env') {
			const first = argv[++i];
			if (first != null) {
				opts.env.push(first);
				if (!String(first).includes('=') && i + 1 < argv.length && !String(argv[i + 1]).startsWith('-')) {
					opts.env.push(argv[++i]);
				}
			}
			continue;
		}
		if (a === '--env-file') {
			opts.envFile = argv[++i];
			continue;
		}
		if (a === '--preset') {
			opts.preset = argv[++i];
			continue;
		}
		if (a === '--example') {
			opts.example = argv[++i];
			continue;
		}
		if (String(a).startsWith('-')) {
			continue;
		}
		if (!filePath) {
			filePath = a;
		}
	}
	return { filePath, opts };
}

function parseLogLevel(argv) {
	const idx = argv.indexOf('--log-level');
	if (idx < 0) {
		return 'info';
	}
	const v = argv[idx + 1];
	if (!v) {
		return 'info';
	}
	const level = String(v).toLowerCase();
	if (['error', 'warn', 'info', 'debug', 'trace'].includes(level)) {
		return level;
	}
	return 'info';
}

function createLevelLogger(minLevel) {
	const order = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
	const min = order[minLevel] ?? order.info;
	return (level, msg) => {
		const lvl = order[level] ?? order.info;
		if (lvl > min) {
			return;
		}
		process.stdout.write(String(msg) + '\n');
	};
}

async function main() {
	const argv = process.argv.slice(2);
	if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
		printHelp();
		return;
	}

	if (argv.includes('-v') || argv.includes('--version')) {
		// Best-effort: try reading packaged mmtcli package.json.
		try {
			// eslint-disable-next-line global-require
			const pkgJson = require('./package.json');
			process.stdout.write(String(pkgJson.version || '') + '\n');
		} catch {
			process.stdout.write('\n');
		}
		return;
	}

	const command = argv[0];
	if (command === 'debug-resolve') {
		const msgs = [];
		msgs.push(`execPath: ${process.execPath}`);
		try {
			msgs.push(`mmt-core: ${require.resolve('mmt-core')}`);
		} catch (e) {
			msgs.push(`mmt-core: (not resolved) ${String(e && e.message ? e.message : e)}`);
		}
		try {
			msgs.push(`mmt-core/jsRunner: ${require.resolve('mmt-core/jsRunner')}`);
		} catch (e) {
			msgs.push(`mmt-core/jsRunner: (not resolved) ${String(e && e.message ? e.message : e)}`);
		}
		process.stdout.write(msgs.join('\n') + '\n');
		return;
	}
	if (command !== 'run' && command !== 'print-js') {
		process.stderr.write(`Unknown command: ${command}\n`);
		printHelp();
		process.exitCode = 2;
		return;
	}

	if (command === 'run') {
		if (argv.includes('-h') || argv.includes('--help')) {
			printRunHelp();
			return;
		}
	} else if (command === 'print-js') {
		if (argv.includes('-h') || argv.includes('--help')) {
			printPrintJsHelp();
			return;
		}
	}

	const logLevel = parseLogLevel(argv);
	const levelLogger = createLevelLogger(logLevel);

	const parsed = command === 'run' ? parseRunArgv(argv) : parsePrintJsArgv(argv);
	const filePath = parsed.filePath;
	if (!filePath) {
		process.stderr.write('Missing <file> argument.\n');
		(command === 'run' ? printRunHelp() : printPrintJsHelp());
		process.exitCode = 2;
		return;
	}

	// Run directly using the shared core runner.
	// eslint-disable-next-line global-require
	const { runner } = require('mmt-core');
	let JSer;
	try {
		// eslint-disable-next-line global-require
		JSer = require('mmt-core/JSer');
	} catch {
		JSer = null;
	}
	const jsRunner = createPkgJsRunner();

	const file = fs.readFileSync(filePath, 'utf8');
	const pathMod = require('path');
	const baseDir = pathMod.dirname(pathMod.resolve(process.cwd(), filePath));

	const manualInputs = parsePairs(parsed.opts.input);
	const manualEnvvars = parsePairs(parsed.opts.env);
	const { exampleIndex, exampleName } = parseExampleFlag(parsed.opts.example);
	let envvar = undefined;
	try {
		const runConfig = require('mmt-core').runConfig;
		if (runConfig && typeof runConfig.mergeEnv === 'function') {
			if (parsed.opts.envFile) {
				const envFileRaw = String(parsed.opts.envFile);
				let p = pathMod.isAbsolute(envFileRaw) ? envFileRaw : pathMod.resolve(process.cwd(), envFileRaw);
				if (!fs.existsSync(p)) {
					const alt = pathMod.isAbsolute(envFileRaw) ? envFileRaw : pathMod.join(baseDir, envFileRaw);
					if (fs.existsSync(alt)) {
						p = alt;
					}
				}
				const doc = loadEnvDoc(p);
				let baseEnv = undefined;
				if (runConfig && typeof runConfig.resolvePresetEnv === 'function') {
					baseEnv = runConfig.resolvePresetEnv(doc, parsed.opts.preset);
				} else if (doc && doc.variables) {
					baseEnv = doc.variables;
				}
				envvar = runConfig.mergeEnv({ envvar: baseEnv, manualEnvvars });
				if (command === 'run' && parsed.opts.debugEnv) {
					try {
						process.stdout.write(`debug envFile raw: ${envFileRaw}\n`);
						process.stdout.write(`debug envFile resolved: ${p}\n`);
						process.stdout.write(`debug preset: ${parsed.opts.preset || '(none)'}\n`);
						process.stdout.write(`debug envDoc variables keys: ${doc && doc.variables ? Object.keys(doc.variables).join(',') : '(none)'}\n`);
						process.stdout.write(`debug envDoc presets keys: ${doc && doc.presets ? Object.keys(doc.presets).join(',') : '(none)'}\n`);
						process.stdout.write(`debug baseEnv keys: ${baseEnv ? Object.keys(baseEnv).join(',') : '(none)'}\n`);
					} catch {
						// ignore
					}
				}
			} else {
				envvar = runConfig.mergeEnv({ envvar: undefined, manualEnvvars });
			}
		}
	} catch {
		envvar = manualEnvvars && Object.keys(manualEnvvars).length ? manualEnvvars : undefined;
	}
	if (command === 'run' && parsed.opts.debugEnv) {
		try {
			process.stdout.write(`debug envvar keys: ${envvar ? Object.keys(envvar).join(',') : '(none)'}\n`);
		} catch {
			process.stdout.write('debug envvar keys: (error)\n');
		}
	}
	// (Keep docType debug off by default; use `debug-resolve` for pkg debugging.)
	if (command === 'print-js') {
		const js = await runner.generateTestJs({
			rawText: file,
			name: pathMod.basename(filePath).replace(/[^a-zA-Z0-9_]/g, '_'),
			inputs: manualInputs,
			envVars: envvar || {},
			fileLoader: async (p) => fs.promises.readFile(p, 'utf8'),
		});
		process.stdout.write(js.trim() + '\n');
		return;
	}

	let res;
	try {
		res = await runner.runFile({
			file,
			fileType: 'raw',
			filePath,
			inputs: { type: 'manual', manualInputs },
			envvar,
			manualInputs,
			manualEnvvars,
			exampleIndex,
			exampleName,
			fileLoader: async (p) => fs.promises.readFile(p, 'utf8'),
			jsRunner: (code, title, lg) => jsRunner.runJSCode({ code, title, logger: lg }),
			logger: (lvl, msg) => levelLogger(lvl, msg),
		});
	} catch (e) {
		process.stderr.write(`runner.runFile threw: ${String(e && e.message ? e.message : e)}\n`);
		throw e;
	}
	if (parsed.opts.debugEnv) {
		try {
			process.stdout.write(`debug envVarsUsed: ${JSON.stringify(res.envVarsUsed || {})}\n`);
		} catch {
			process.stdout.write('debug envVarsUsed: (error)\n');
		}
	}

	if (parsed.opts.printJs && res && typeof res.js === 'string' && res.js.trim()) {
		process.stdout.write(res.js.trim() + '\n');
	}

	if (!parsed.opts.quiet) {
		process.stdout.write(`Loaded: ${filePath}\n`);
		process.stdout.write(`Success: ${String(res.result?.success)}\n`);
		if (Array.isArray(res.result?.errors) && res.result.errors.length) {
			process.stdout.write('Errors:\n');
			for (const err of res.result.errors) {
				process.stdout.write(`- ${String(err)}\n`);
			}
		}
	}

	if (parsed.opts.out) {
		const outPath = pathMod.isAbsolute(String(parsed.opts.out)) ? String(parsed.opts.out) : pathMod.join(process.cwd(), String(parsed.opts.out));
		fs.writeFileSync(outPath, JSON.stringify(res.result, null, 2), 'utf8');
		if (!parsed.opts.quiet) {
			process.stdout.write(`Result written: ${outPath}\n`);
		}
	}

	process.exitCode = res.result?.success ? 0 : 1;
}

main().catch((e) => {
	process.stderr.write(String(e?.stack || e) + '\n');
	process.exitCode = 1;
});
