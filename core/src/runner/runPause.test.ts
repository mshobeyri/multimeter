import {createRunPauseGate} from './runPause';

describe('createRunPauseGate', () => {
  it('waits while paused and continues after resume', async () => {
    const gate = createRunPauseGate();
    gate.pause();
    expect(gate.paused).toBe(true);

    let resumed = false;
    const waiting = gate.waitIfPaused().then(() => {
      resumed = true;
    });
    await Promise.resolve();
    expect(resumed).toBe(false);

    gate.resume();
    await waiting;
    expect(resumed).toBe(true);
    expect(gate.paused).toBe(false);
  });

  it('wakes waiters when abortSignal fires so Stop works while paused', async () => {
    const controller = new AbortController();
    const gate = createRunPauseGate(controller.signal);
    gate.pause();

    const waiting = gate.waitIfPaused();
    controller.abort();
    await waiting;
    expect(gate.paused).toBe(true);
  });
});
