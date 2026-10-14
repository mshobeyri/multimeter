/** Display title for a report step — shared by MMT / HTML / Markdown / JUnit. */
export function reportStepTitle(step: {
  title?: string;
  stepType?: string;
  stepIndex?: number;
}): string {
  if (step.title && String(step.title).trim()) {
    return String(step.title).trim();
  }
  if (step.stepType === 'assert') {
    return 'Assert';
  }
  if (step.stepType === 'debug') {
    return 'Debug';
  }
  if (step.stepType === 'check') {
    return 'Check';
  }
  if (typeof step.stepIndex === 'number') {
    return `step-${step.stepIndex}`;
  }
  return 'Check';
}
