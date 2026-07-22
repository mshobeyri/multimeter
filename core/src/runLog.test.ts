import {logRunFinished} from './runLog';

describe('logRunFinished', () => {
  it('logs success with duration', () => {
    const lines: Array<{level: string; message: string}> = [];
    logRunFinished((level, message) => lines.push({level, message}), 'API', 'Get sample', true, 12);
    expect(lines).toEqual([
      {level: 'info', message: 'API "Get sample" finished in 12 ms successfully'},
    ]);
  });

  it('logs failed for check/assertion failures', () => {
    const lines: Array<{level: string; message: string}> = [];
    logRunFinished((level, message) => lines.push({level, message}), 'Test', 'login', false);
    expect(lines).toEqual([
      {level: 'error', message: 'Test "login" failed'},
    ]);
  });

  it('logs has error for runtime exceptions', () => {
    const lines: Array<{level: string; message: string}> = [];
    logRunFinished(
        (level, message) => lines.push({level, message}), 'API', 'Get sample JSON', false,
        undefined, {hasError: true});
    expect(lines).toEqual([
      {level: 'error', message: 'API "Get sample JSON" has error'},
    ]);
  });
});
