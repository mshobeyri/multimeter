import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {buildCliRunArgs} from './runArgs.js';

function createTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'cli-run-args-'));
}

function writeFile(dir: string, name: string, contents: string): string {
	const full = path.join(dir, name);
	fs.writeFileSync(full, contents, 'utf8');
	return full;
}

describe('buildCliRunArgs', () => {
	const tempDirs: string[] = [];
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		while (tempDirs.length) {
			const dir = tempDirs.pop();
			if (dir) {
				fs.rmSync(dir, {recursive: true, force: true});
			}
		}
	});

	it('builds run options with manual input/env and env presets', async () => {
		const dir = createTempDir();
		tempDirs.push(dir);
		const filePath = writeFile(dir, 'sample.mmt', 'type: api\nname: cli');
		writeFile(dir, 'payload.txt', 'payload');
		const envPath = writeFile(dir, 'envvars.mmt', `type: env\nvariables:\n  API_URL:\n    dev: http://dev.local\n    prod: http://prod.local\npresets:\n  runner:\n    dev:\n      API_URL: dev\n      AUTH_TOKEN: static-token\n`);

		process.chdir(dir);

		const parsed = buildCliRunArgs('./sample.mmt', {
			input: ['userId=42'],
			env: ['trace=true'],
			envFile: path.basename(envPath),
			preset: 'runner.dev',
			quiet: true,
			out: 'result.json',
			printJs: true,
		});

		expect(parsed.quiet).toBe(true);
		expect(parsed.outFile).toBe('result.json');
		expect(parsed.printJs).toBe(true);

		const {runFileOptions} = parsed;
		expect(runFileOptions.filePath).toBe(fs.realpathSync(path.join(dir, 'sample.mmt')));
		expect(runFileOptions.file).toContain('type: api');
		expect(runFileOptions.manualInputs).toEqual({userId: 42});
		expect(runFileOptions.manualEnvvars).toEqual({trace: true});
		expect(runFileOptions.envvar).toEqual({
			API_URL: 'http://dev.local',
			AUTH_TOKEN: 'static-token',
		});

		const loaderResult = await (runFileOptions as any).fileLoader('payload.txt');
		expect(loaderResult).toBe('payload');
	});

	it('supports space-separated key/value tokens and relative env paths', async () => {
		const dir = createTempDir();
		tempDirs.push(dir);
		const filePath = writeFile(dir, 'flow.mmt', 'type: test\nname: flow');
		writeFile(dir, 'fixture.json', '{"ok":true}');

		process.chdir(dir);

		const parsed = buildCliRunArgs('./flow.mmt', {
			input: ['limit', '5'],
			env: ['region', 'us-east'],
			quiet: false,
			printJs: false,
		});

		expect(parsed.quiet).toBe(false);
		expect(parsed.outFile).toBeUndefined();
		expect(parsed.printJs).toBe(false);

		const {runFileOptions} = parsed;
		expect(runFileOptions.filePath).toBe(fs.realpathSync(filePath));
		expect(runFileOptions.manualInputs).toEqual({limit: 5});
		expect(runFileOptions.manualEnvvars).toEqual({region: 'us-east'});
		expect(runFileOptions.envvar).toBeUndefined();

		const loaderResult = await (runFileOptions as any).fileLoader('fixture.json');
		expect(loaderResult).toBe('{"ok":true}');
	});
});
