export function less(a: any, b: any) {
  return a < b;
}

export function greater(a: any, b: any) {
  return a > b;
}

export function lessOrEqual(a: any, b: any) {
  return a <= b;
}

export function greaterOrEqual(a: any, b: any) {
  return a >= b;
}

export function equals(a: any, b: any) {
  return a === b;
}

export function notEquals(a: any, b: any) {
  return a !== b;
}

export function isAt(a: any, b: any) {
  // Checks if a is in b (for strings or arrays)
  if (typeof b === 'string' || Array.isArray(b)) {
    return b.includes(a);
  }
  return false;
}

export function isNotAt(a: any, b: any) {
  if (typeof b === 'string' || Array.isArray(b)) {
    return !b.includes(a);
  }
  return true;
}

export function matches(a: any, b: any) {
  // b is a regex string, e.g. "^foo.*"
  try {
    const re = new RegExp(b);
    return re.test(a);
  } catch {
    return false;
  }
}

export function notMatches(a: any, b: any) {
  try {
    const re = new RegExp(b);
    return !re.test(a);
  } catch {
    return true;
  }
}

export function startsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.startsWith(b);
  }
  return false;
}

export function notStartsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.startsWith(b);
  }
  return true;
}

export function endsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.endsWith(b);
  }
  return false;
}

export function notEndsWith(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.endsWith(b);
  }
  return true;
}
declare const __mmtReportStep:|((event: Record<string, any>) => void)|undefined;
declare const __mmtRunId: string|undefined;

type StepType = 'check'|'assert';

const resolveReporter = () =>
    (typeof __mmtReportStep === 'function' ? __mmtReportStep : undefined);

const ensurePayload = (event: Record<string, any>): Record<string, any> => {
  const payload = {...event};
  if (typeof payload.timestamp !== 'number') {
    payload.timestamp = Date.now();
  }
  if (!payload.runId) {
    payload.runId = typeof __mmtRunId === 'string' ? __mmtRunId : '';
  }
  return payload;
};

let lastRunId: string|undefined;
let stepIndex = 0;
const nextStepIndex = (): number => {
  const currentRunId = typeof __mmtRunId === 'string' ? __mmtRunId : '';
  if (currentRunId !== lastRunId) {
    lastRunId = currentRunId;
    stepIndex = 0;
  }
  stepIndex += 1;
  return stepIndex;
};

const emitStep = (event: Record<string, any>) => {
  const reporter = resolveReporter();
  if (!reporter) {
    console.log('No reporter available to emit step:', event);
    return;
  }
  try {
    reporter(ensurePayload(event));
  } catch {
    // Ignore reporter errors so tests keep running
  }
};

const report_check_assert_ =
    (stepType: StepType, message: string, passed: boolean) => {
      const payload = {
        scope: 'test-step',
        stepType,
        message,
        stepIndex: nextStepIndex(),
        status: passed ? 'passed' : 'failed',
      };
      emitStep(payload);
    };

export function report_check_(passed: boolean, message: string) {
  report_check_assert_('check', message, passed);
}

export function report_assert_(passed: boolean, message: string) {
  report_check_assert_('assert', message, passed);
}