/** Step types that can appear as `- <type>:` list items in a test flow. */
export const TEST_STEP_TYPES = [
  'call', 'http', 'check', 'assert', 'judge', 'if', 'for', 'repeat', 'data',
  'print', 'js', 'set', 'var', 'const', 'let', 'delay', 'setenv', 'run',
] as const;

export type TestStepType = (typeof TEST_STEP_TYPES)[number];

const STEP_LINE_RE = new RegExp(
    `^-\\s*(${TEST_STEP_TYPES.join('|')})\\s*:`,
);

/** Match a flow step dash line (`- call:`, `- http:`, …). */
export function matchTestStepLine(trimmedLine: string): TestStepType | null {
  const m = trimmedLine.match(STEP_LINE_RE);
  return m ? (m[1] as TestStepType) : null;
}
