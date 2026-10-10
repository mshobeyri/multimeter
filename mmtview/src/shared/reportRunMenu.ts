import type { ReportFormat } from 'mmt-core/CommonData';
import type { SendButtonMenuEntry } from '../components/SendButton';

export const REPORT_EXPORT_FORMATS: readonly { value: ReportFormat; label: string }[] = [
  { value: 'junit', label: 'JUnit XML' },
  { value: 'mmt', label: 'MMT Report' },
  { value: 'html', label: 'HTML' },
  { value: 'md', label: 'Markdown' },
  { value: 'md-detailed', label: 'Markdown (detailed)' },
];

/**
 * Run ▾ menu for test/suite: Pause/Resume first, then primary actions, then
 * Export formats (same heading pattern as body format RAW / YAML-encoded).
 */
export function buildReportRunMenuEntries(opts: {
  onRunInCore: () => void | Promise<void>;
  runInCoreDisabled?: boolean;
  /** When set, Pause/Resume is the first menu item. */
  onPause?: () => void;
  onResume?: () => void;
  /** True while the active run is paused (menu shows Resume). */
  paused?: boolean;
  /** True while a run is in progress (enables Pause). */
  canPause?: boolean;
  onClear: () => void;
  clearDisabled?: boolean;
  onExport: (format: ReportFormat) => void;
  exportDisabled?: boolean;
}): SendButtonMenuEntry[] {
  const entries: SendButtonMenuEntry[] = [];
  if (opts.onPause && opts.onResume) {
    const paused = opts.paused === true;
    entries.push({
      label: paused ? 'Resume' : 'Pause',
      icon: paused ? 'codicon-debug-continue' : 'codicon-debug-pause',
      disabled: paused ? false : opts.canPause !== true,
      onClick: paused ? opts.onResume : opts.onPause,
    });
  }
  entries.push(
    {
      label: 'Run in Core',
      icon: 'codicon-play',
      disabled: opts.runInCoreDisabled,
      onClick: () => {
        window.vscode?.postMessage({ command: 'showLogOutputChannel' });
        void opts.onRunInCore();
      },
    },
    {
      label: 'Clear',
      icon: 'codicon-clear-all',
      disabled: opts.clearDisabled,
      onClick: opts.onClear,
    },
    { kind: 'heading', label: 'Export' },
    ...REPORT_EXPORT_FORMATS.map(({ value, label }) => ({
      label,
      disabled: opts.exportDisabled,
      onClick: () => opts.onExport(value),
    })),
  );
  return entries;
}
