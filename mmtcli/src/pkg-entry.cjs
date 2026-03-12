// CommonJS entrypoint for pkg.
//
// This file is executed by pkg's CJS loader. To avoid ESM/CJS interop issues
// (and snapshot path quirks), we implement a minimal CLI here.

const fs = require('fs');
const path = require('path');

/**
 * Walk up from startPath looking for multimeter.mmt.
 * Returns the directory containing it, or undefined.
 */
function findProjectRootForPkg(startPath) {
	let currentDir = path.dirname(startPath);
	const visited = new Set();
	while (currentDir && !visited.has(currentDir)) {
		visited.add(currentDir);
		const markerPath = path.join(currentDir, 'multimeter.mmt');
		try {
			if (fs.existsSync(markerPath)) {
				return currentDir;
			}
		} catch { /* continue */ }
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir || !parentDir) {
			break;
		}
		currentDir = parentDir;
	}
	return undefined;
}

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
	// networkCore is not in the default export (browser-safe). Load it from the
	// compiled core dist. Use a static string so pkg can resolve it at build time.
	let networkCore;
	try {
		// eslint-disable-next-line global-require
		networkCore = require('../../core/dist/networkCoreNode.js');
	} catch {
		try {
			// eslint-disable-next-line global-require
			networkCore = require('../../core/dist/networkCore.js');
		} catch { /* give up */ }
	}
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
		runJSCode: async ({ js: code, title, logger, fileLoader, serverRunner, reporter, runId, id, traceSend, abortSignal }) => {
			const startTime = Date.now();
			const lg = (level, msg) => logger(level, msg);
			const customConsole = {
				trace: (...args) => lg('trace', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				debug: (...args) => lg('debug', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				log: (...args) => lg('info', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				warn: (...args) => lg('warn', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
				error: (...args) => lg('error', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
			};
			// Set file loader, abort signal and server runner before executing
			if (typeof testHelper.setFileLoader_ === 'function') {
				testHelper.setFileLoader_(typeof fileLoader === 'function' ? fileLoader : undefined);
			}
			if (typeof testHelper.setAbortSignal_ === 'function') {
				testHelper.setAbortSignal_(abortSignal);
			}
			if (typeof testHelper.setServerRunner_ === 'function') {
				testHelper.setServerRunner_(serverRunner);
			}
			try {
				const helperDecls = Object.keys(testHelper)
					.filter((name) => name !== 'report_' && name !== 'setenv_')
					.map((name) => `const ${name} = mmtHelper["${name}"];`)
					.join('\n');
				const randomDecls = Object.keys(Random)
					.filter((name) => typeof Random[name] === 'function')
					.map((name) => `const ${name} = Random["${name}"];`)
					.join('\n');

				const reporterFn = typeof reporter === 'function' ? reporter : () => {};
				const mmtRandom = mmtCore.Random || {};
				const mmtCurrent = mmtCore.Current || {};

				const fn = new Function(
					'mmtHelper',
					'console',
					'send_',
					'extractOutputs_',
					'Random',
					'__reporter',
					'__runId',
					'__id',
					'__mmt_random',
					'__mmt_current',
					`${helperDecls}\n${randomDecls}\n` +
					`const report_ = (...args) => mmtHelper.reportWithContext_ ? mmtHelper.reportWithContext_(__reporter, __runId, __id, ...args) : undefined;\n` +
					`const setenv_ = (name, value) => mmtHelper.setenvWithContext_ ? mmtHelper.setenvWithContext_(__reporter, __runId, __id, name, value) : undefined;\n` +
					`${code}`,
				);

				// Wrap send_ with trace-level logging when requested
				const sendFn = traceSend ? async (req) => {
					const reqSummary = req ? `${(req.method || 'GET').toUpperCase()} ${req.url || ''}` : 'unknown';
					lg('trace', `Request: ${reqSummary}`);
					try {
						const res = await networkCore.send(req);
						const status = res && typeof res.status === 'number' ? res.status : '?';
						const duration = res && typeof res.duration === 'number' ? ` (${res.duration}ms)` : '';
						lg('trace', `Response: ${status}${duration}`);
						return res;
					} catch (err) {
						lg('trace', `Response: error - ${err?.message || String(err)}`);
						throw err;
					}
				} : networkCore.send;

				await fn(
					testHelper,
					customConsole,
					sendFn,
					outputExtractor.extractOutputs,
					Random,
					reporterFn,
					runId || '',
					id || '',
					mmtRandom,
					mmtCurrent,
				);
			} finally {
				// Clean up
				if (typeof testHelper.setServerRunner_ === 'function') {
					testHelper.setServerRunner_(undefined);
				}
				if (typeof testHelper.setAbortSignal_ === 'function') {
					testHelper.setAbortSignal_(undefined);
				}
				const elapsed = Date.now() - startTime;
				lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
			}
		},
		setRunnerNetworkConfig: networkCore.setRunnerNetworkConfig,
	};
}

/**
 * Create a server runner for pkg builds that starts mock servers from .mmt files.
 */
function createPkgServerRunner(envVars) {
	const http = require('http');
	const https = require('https');
	const pathMod = require('path');
	const yaml = require('js-yaml');
	const mmtCore = require('mmt-core');
	const mockParsePack = mmtCore.mockParsePack;
	const mockServer = mmtCore.mockServer;
	const variableReplacer = mmtCore.variableReplacer;

	if (!mockParsePack || !mockServer || !variableReplacer) {
		return null;
	}

	const activeServers = new Map();

	function resolveFilePath(relative, basePath) {
		if (pathMod.isAbsolute(relative)) {
			return relative;
		}
		return pathMod.resolve(pathMod.dirname(basePath), relative);
	}

	const serverRunner = async (alias, filePath) => {
		// Stop existing server on this path if any
		const existing = activeServers.get(filePath);
		if (existing) {
			existing.dispose();
		}

		const rawContent = fs.readFileSync(filePath, 'utf-8');
		let parsed;
		try {
			parsed = yaml.load(rawContent);
		} catch (err) {
			throw new Error(`Mock server: YAML parse error in ${pathMod.basename(filePath)}: ${err.message}`);
		}

		const result = mockParsePack.parseMockData(parsed);
		if (result.errors.length > 0 || !result.data) {
			const msg = result.errors.map(e => e.message).join('; ');
			throw new Error(`Mock server validation errors in ${pathMod.basename(filePath)}: ${msg}`);
		}
		const data = result.data;

		// Check if a server is already running on this port
		for (const [, handle] of activeServers) {
			if (handle.port === data.port) {
				return () => {};
			}
		}

		// Create token resolver
		const tokenResolver = (value) => {
			variableReplacer.resetRandomTokenCache();
			variableReplacer.resetCurrentTokenCache();
			return variableReplacer.resolveEmbeddedTokens(value, envVars);
		};

		// Resolve tokens in global headers
		if (data.headers) {
			for (const [k, v] of Object.entries(data.headers)) {
				if (typeof v === 'string') {
					data.headers[k] = String(variableReplacer.resolveEmbeddedTokens(v, envVars));
				}
			}
		}

		const router = mockServer.createMockRouter(data, tokenResolver);

		const requestHandler = (req, res) => {
			const method = (req.method || 'GET').toLowerCase();
			const urlStr = req.url || '/';

			if (data.cors) {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Access-Control-Allow-Methods', '*');
				res.setHeader('Access-Control-Allow-Headers', '*');
				if (method === 'options') {
					res.statusCode = 204;
					res.end();
					return;
				}
			}

			let body = '';
			req.on('data', chunk => { body += chunk; });
			req.on('end', async () => {
				let pathname = urlStr;
				const queryObj = {};
				const qIdx = urlStr.indexOf('?');
				if (qIdx >= 0) {
					pathname = urlStr.slice(0, qIdx);
					const searchParams = new URLSearchParams(urlStr.slice(qIdx + 1));
					searchParams.forEach((v, k) => { queryObj[k] = v; });
				}

				let parsedBody;
				try {
					parsedBody = JSON.parse(body);
				} catch {
					parsedBody = body || undefined;
				}

				const mockReq = {
					method,
					path: pathname,
					headers: req.headers || {},
					query: queryObj,
					body: parsedBody,
				};

				let mockRes;
				try {
					mockRes = router(mockReq);
				} catch (err) {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: 'Mock router error', message: err.message }));
					return;
				}

				if (mockRes.delay && mockRes.delay > 0) {
					await new Promise(resolve => setTimeout(resolve, mockRes.delay));
				}

				if (mockRes.headers) {
					for (const [k, v] of Object.entries(mockRes.headers)) {
						if (typeof v === 'string') {
							res.setHeader(k, String(variableReplacer.resolveEmbeddedTokens(v, envVars)));
						} else {
							res.setHeader(k, v);
						}
					}
				}

				res.statusCode = mockRes.status;
				const responseBody = mockRes.body !== undefined ? (
					typeof mockRes.body === 'string' ? mockRes.body : JSON.stringify(mockRes.body)
				) : '';
				res.end(responseBody);
			});
		};

		let server;
		const protocol = data.protocol || 'http';
		if (protocol === 'https' && data.tls) {
			const certPath = resolveFilePath(data.tls.cert, filePath);
			const keyPath = resolveFilePath(data.tls.key, filePath);
			const tlsOptions = {
				cert: fs.readFileSync(certPath),
				key: fs.readFileSync(keyPath),
			};
			if (data.tls.ca) {
				tlsOptions.ca = fs.readFileSync(resolveFilePath(data.tls.ca, filePath));
			}
			if (data.tls.requestCert) {
				tlsOptions.requestCert = true;
				tlsOptions.rejectUnauthorized = false;
			}
			server = https.createServer(tlsOptions, requestHandler);
		} else {
			server = http.createServer(requestHandler);
		}

		return new Promise((resolve, reject) => {
			server.on('listening', () => {
				const dispose = () => {
					try { server.close(); } catch { /* ignore */ }
					activeServers.delete(filePath);
				};
				activeServers.set(filePath, { server, port: data.port, dispose });
				resolve(dispose);
			});
			server.on('error', (err) => {
				activeServers.delete(filePath);
				if (err.code === 'EADDRINUSE') {
					reject(new Error(`Mock server: port ${data.port} is already in use.`));
				} else {
					reject(new Error(`Mock server error: ${err.message}`));
				}
			});
			server.listen(data.port);
		});
	};

	const stopAll = () => {
		for (const [, handle] of activeServers) {
			handle.dispose();
		}
		activeServers.clear();
	};

	return { serverRunner, stopAll };
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
		// Check networkCore resolution
		const pathMod = require('path');
		try {
			const coreDir = pathMod.dirname(require.resolve('mmt-core'));
			msgs.push(`mmt-core dir: ${coreDir}`);
			const ncPath = pathMod.join(coreDir, 'networkCoreNode.js');
			msgs.push(`networkCoreNode path: ${ncPath}`);
			const nc = require(ncPath);
			msgs.push(`networkCoreNode.send: ${typeof nc.send}`);
		} catch (e) {
			msgs.push(`networkCoreNode: (failed) ${String(e && e.message ? e.message : e)}`);
		}
		// Check jsRunner
		const jsRunner = createPkgJsRunner();
		msgs.push(`jsRunner.runJSCode: ${typeof jsRunner.runJSCode}`);
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
	let filePath = parsed.filePath;
	if (!filePath) {
		process.stderr.write('Missing <file> argument.\n');
		(command === 'run' ? printRunHelp() : printPrintJsHelp());
		process.exitCode = 2;
		return;
	}
	// Resolve to absolute path so that all subsequent relative path resolution
	// produces absolute paths readable from disk (pkg can't read relative paths).
	const pathMod = require('path');
	filePath = pathMod.resolve(process.cwd(), filePath);

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
	const baseDir = pathMod.dirname(filePath);

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
	// Create server runner for mock servers
	const mockRunnerInstance = createPkgServerRunner(envvar || {});
	const pkgServerRunner = mockRunnerInstance ? mockRunnerInstance.serverRunner : undefined;

	// Detect if running a suite file and build suite bundle for proper export handling
	let suiteBundleArg;
	let mergedEnvvar = envvar; // Default to CLI-resolved envvar
	const yaml = require('js-yaml');
	try {
		const parsedYaml = yaml.load(file);
		if (parsedYaml && parsedYaml.type === 'suite') {
			const mmtCore = require('mmt-core');
			const { suiteHierarchy, suiteBundle, runConfig: coreRunConfig } = mmtCore;
			if (suiteHierarchy && suiteBundle) {
				const fileLoader = async (p) => fs.promises.readFile(p, 'utf8');
				const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
					suiteFilePath: filePath,
					suiteRawText: file,
					fileLoader,
				});
				suiteBundleArg = suiteBundle.createSuiteBundle({
					rootSuitePath: filePath,
					hierarchy: tree,
					servers: tree.servers,
					environment: tree.environment,
					export: tree.export,
				});

				// Merge suite environment with CLI env vars
				// Priority: CLI -e > suite variables > suite preset > CLI --env-file/--preset
				if (tree.environment && coreRunConfig && typeof coreRunConfig.mergeSuiteEnv === 'function') {
					let suitePresetEnv = {};
					const suiteEnv = tree.environment;

					// Resolve suite preset from env file
					if (suiteEnv.preset) {
						let envFileForPreset = null;
						if (suiteEnv.file) {
							// Suite specifies its own env file
							const suiteEnvFile = suiteEnv.file.startsWith('+/')
								? pathMod.resolve(baseDir, suiteEnv.file.slice(2))
								: pathMod.resolve(baseDir, suiteEnv.file);
							if (fs.existsSync(suiteEnvFile)) {
								envFileForPreset = loadEnvDoc(suiteEnvFile);
							}
						} else if (parsed.opts.envFile) {
							// Use CLI --env-file for preset resolution
							const envFileRaw = String(parsed.opts.envFile);
							let p = pathMod.isAbsolute(envFileRaw) ? envFileRaw : pathMod.resolve(process.cwd(), envFileRaw);
							if (!fs.existsSync(p)) {
								const alt = pathMod.isAbsolute(envFileRaw) ? envFileRaw : pathMod.join(baseDir, envFileRaw);
								if (fs.existsSync(alt)) {
									p = alt;
								}
							}
							if (fs.existsSync(p)) {
								envFileForPreset = loadEnvDoc(p);
							}
						}
						if (envFileForPreset && coreRunConfig.resolvePresetEnv) {
							suitePresetEnv = coreRunConfig.resolvePresetEnv(envFileForPreset, suiteEnv.preset) || {};
						}
					}

					mergedEnvvar = coreRunConfig.mergeSuiteEnv({
						baseEnv: envvar || {},
						suiteEnv: suiteEnv,
						suitePresetEnv: suitePresetEnv,
						manualEnvvars: manualEnvvars || {},
						cliOverridesSuiteEnv: true, // CLI -e takes precedence
					});

					if (command === 'run' && parsed.opts.debugEnv) {
						process.stdout.write(`debug suite environment: ${JSON.stringify(suiteEnv)}\n`);
						process.stdout.write(`debug suite preset env keys: ${Object.keys(suitePresetEnv).join(',') || '(none)'}\n`);
						process.stdout.write(`debug merged envvar keys: ${Object.keys(mergedEnvvar).join(',') || '(none)'}\n`);
					}
				}
			}
		}
	} catch (e) {
		// If YAML parsing fails or suite bundle creation fails, continue without bundle
		// The runner will still attempt to run the file and report appropriate errors
	}

	// Update mockRunnerInstance with merged env vars for suite runs
	if (suiteBundleArg && mergedEnvvar !== envvar) {
		// Re-create server runner with merged env vars
		const mergedMockRunnerInstance = createPkgServerRunner(mergedEnvvar || {});
		if (mergedMockRunnerInstance) {
			// Stop original mock runner to avoid conflicts
			if (mockRunnerInstance) {
				mockRunnerInstance.stopAll();
			}
			// Use the merged one for suite execution
			Object.assign(mockRunnerInstance || {}, { serverRunner: mergedMockRunnerInstance.serverRunner, stopAll: mergedMockRunnerInstance.stopAll });
		}
	}

	const projectRoot = findProjectRootForPkg(filePath);

	try {
		res = await runner.runFile({
			file,
			fileType: 'raw',
			filePath,
			projectRoot,
			inputs: { type: 'manual', manualInputs },
			envvar: mergedEnvvar,
			manualInputs,
			manualEnvvars,
			exampleIndex,
			exampleName,
			fileLoader: async (p) => fs.promises.readFile(p, 'utf8'),
			jsRunner: (ctx) => jsRunner.runJSCode({ ...ctx, serverRunner: pkgServerRunner }),
			logger: (lvl, msg) => levelLogger(lvl, msg),
			serverRunner: pkgServerRunner,
			suiteBundle: suiteBundleArg,
		});
	} catch (e) {
		process.stderr.write(`runner.runFile threw: ${String(e && e.message ? e.message : e)}\n`);
		throw e;
	} finally {
		// Always stop mock servers after run completes
		if (mockRunnerInstance) {
			mockRunnerInstance.stopAll();
		}
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

	// Handle suite exports (from suite file's export: field)
	const suiteExports = res.suiteExports;
	if (suiteExports && Array.isArray(suiteExports.paths) && suiteExports.collectedResults) {
		const suiteDir = pathMod.dirname(filePath);
		// eslint-disable-next-line global-require
		const mmtCore = require('mmt-core');

		for (const exportPath of suiteExports.paths) {
			try {
				// Resolve path relative to suite file or +/ project root
				let resolvedPath;
				if (exportPath.startsWith('+/')) {
					// Project root not supported in standalone binary; skip
					if (!parsed.opts.quiet) {
						process.stderr.write(`Cannot resolve +/ path in standalone binary: ${exportPath}\n`);
					}
					continue;
				} else {
					resolvedPath = pathMod.resolve(suiteDir, exportPath);
				}

				// Determine format from extension
				const ext = pathMod.extname(resolvedPath).toLowerCase();
				const formatForExt = {
					'.xml': 'junit',
					'.html': 'html',
					'.md': 'md',
					'.mmt': 'mmt',
				};
				const format = formatForExt[ext];
				if (!format) {
					if (!parsed.opts.quiet) {
						process.stderr.write(`Unknown export format for extension ${ext}: ${exportPath}\n`);
					}
					continue;
				}

				// Generate report content
				const exportSerializers = {
					junit: mmtCore.junitXml?.generateJunitXml,
					mmt: mmtCore.mmtReport?.generateMmtReport,
					html: mmtCore.reportHtml?.generateReportHtml,
					md: mmtCore.reportMarkdown?.generateReportMarkdown,
				};
				const serializer = exportSerializers[format];
				if (typeof serializer !== 'function') {
					if (!parsed.opts.quiet) {
						process.stderr.write(`Export serializer not available for format: ${format}\n`);
					}
					continue;
				}

				if (!parsed.opts.quiet) {
					process.stdout.write(`Exporting results to ${resolvedPath}\n`);
				}
				const content = serializer(suiteExports.collectedResults);

				// Create parent directories if they don't exist
				const parentDir = pathMod.dirname(resolvedPath);
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				fs.writeFileSync(resolvedPath, content, 'utf8');
				if (!parsed.opts.quiet) {
					process.stdout.write(`Suite export written: ${resolvedPath}\n`);
				}
			} catch (e) {
				if (!parsed.opts.quiet) {
					process.stderr.write(`Failed to write suite export ${exportPath}: ${e?.message || e}\n`);
				}
			}
		}
	}

	process.exitCode = res.result?.success ? 0 : 1;
}

main().catch((e) => {
	process.stderr.write(String(e?.stack || e) + '\n');
	process.exitCode = 1;
});
