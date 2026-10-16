// Abort / cancel helpers for the Node network stack.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');

import {isTestAbortError, TestAbortError} from '../runner/testHelper';

/** True when the caller aborted the request (AbortSignal or Axios cancel). */
export function isAbortError(err: any, signal?: AbortSignal): boolean {
  if (signal?.aborted || isTestAbortError(err)) {
    return true;
  }
  if (!err || typeof err !== 'object') {
    return false;
  }
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' ||
      err.name === 'AbortError') {
    return true;
  }
  // Axios legacy cancel / message variants.
  return typeof axios.isCancel === 'function' && axios.isCancel(err);
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new TestAbortError();
  }
}

export function attachAbortSignal(
    signal: AbortSignal|undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => {};
  }
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  signal.addEventListener('abort', onAbort, {once: true});
  return () => signal.removeEventListener('abort', onAbort);
}
