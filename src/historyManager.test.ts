/**
 * HistoryManager persistence: prepend, timestamp, max length, clear.
 * Uses an in-memory vscode.workspace.fs stand-in (no real disk).
 */

const executeCommand = jest.fn(async () => undefined);
const files = new Map<string, Uint8Array>();

jest.mock('vscode', () => {
  return {
    Uri: {
      joinPath: (base: {fsPath: string}, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
        toString: () => `file://${[base.fsPath, ...parts].join('/')}`,
      }),
      file: (fsPath: string) => ({
        fsPath,
        toString: () => `file://${fsPath}`,
      }),
    },
    workspace: {
      fs: {
        readFile: async (uri: {fsPath: string}) => {
          const data = files.get(uri.fsPath);
          if (!data) {
            const err: any = new Error('ENOENT');
            err.code = 'FileNotFound';
            throw err;
          }
          return data;
        },
        writeFile: async (uri: {fsPath: string}, data: Uint8Array) => {
          files.set(uri.fsPath, data);
        },
      },
    },
    commands: {executeCommand},
  };
}, {virtual: true});

import {HistoryManager} from './historyManager';

describe('HistoryManager', () => {
  beforeEach(() => {
    files.clear();
    executeCommand.mockClear();
  });

  async function flush(manager: HistoryManager) {
    await (manager as any).writeChain;
  }

  async function readStored(): Promise<any[]> {
    const raw = files.get('/storage/history.json');
    if (!raw) {
      return [];
    }
    return JSON.parse(Buffer.from(raw).toString('utf8'));
  }

  it('prepends entries, stamps time, and refreshes the panel', async () => {
    const manager = new HistoryManager({fsPath: '/storage'} as any);
    manager.add({
      type: 'send',
      method: 'POST',
      protocol: 'http',
      title: 'https://a',
      content: 'one',
    });
    await flush(manager);
    manager.add({
      type: 'recv',
      method: 'POST',
      protocol: 'http',
      title: 'https://a',
      status: 200,
      content: 'two',
    });
    await flush(manager);

    const history = await readStored();
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('two');
    expect(history[1].content).toBe('one');
    expect(history[0].time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(executeCommand).toHaveBeenCalledWith('multimeter.history.refresh');
  });

  it('keeps at most 500 entries', async () => {
    const manager = new HistoryManager({fsPath: '/storage'} as any);
    for (let i = 0; i < 505; i++) {
      manager.add({
        type: 'send',
        method: 'GET',
        protocol: 'http',
        title: `https://x/${i}`,
      });
    }
    await flush(manager);

    const history = await readStored();
    expect(history).toHaveLength(500);
    expect(history[0].title).toBe('https://x/504');
    expect(history[499].title).toBe('https://x/5');
  });

  it('clear empties the file and refreshes', async () => {
    const manager = new HistoryManager({fsPath: '/storage'} as any);
    manager.add({
      type: 'send',
      method: 'GET',
      protocol: 'http',
      title: 'https://a',
    });
    await flush(manager);
    manager.clear();
    await flush(manager);

    expect(await readStored()).toEqual([]);
    expect(executeCommand).toHaveBeenCalledWith('multimeter.history.refresh');
  });
});
