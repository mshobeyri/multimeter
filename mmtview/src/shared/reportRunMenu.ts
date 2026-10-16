import type { ReportFormat } from 'mmt-core/data/CommonData';
import type { SendButtonMenuEntry } from '../components/SendButton';

export const REPORT_EXPORT_FORMATS: readonly { value: ReportFormat; label: string }[] = [
  { value: 'junit', label: 'JUnit XML' },
  { value: 'mmt', label: 'MMT Report' },
  { value: 'html', label: 'HTML' },
  { value: 'md', label: 'Markdown' },
  { value: 'md-detailed', label: 'Markdown (detailed)' },
];

/**
 * Run ▾ menu for test/suite: Pause (or Stop when paused) first, then primary
 * actions, then Export formats (same heading pattern as body format RAW /
 * YAML-encoded). Resume lives on the main SendButton when paused.
 */
export function buildReportRunMenuEntries(opts: {
  onRunInCore: () => void | Promise<void>;
  runInCoreDisabled?: boolean;
  /** When set with onStop, Pause/Stop is the first menu item. */
  onPause?: () => void;
  onStop?: () => void;
  /** Label for Stop in the menu while paused. */
  stopLabel?: string;
  /** True while the active run is paused (menu shows Stop; Resume is on the main button). */
  paused?: boolean;
  /** True while a run is in progress (enables Pause). */
  canPause?: boolean;
  onClear: () => void;
  clearDisabled?: boolean;
  onExport: (format: ReportFormat) => void;
  exportDisabled?: boolean;
}): SendButtonMenuEntry[] {
  const entries: SendButtonMenuEntry[] = [];
  if (opts.onPause) {
    const paused = opts.paused === true;
    if (paused && opts.onStop) {
      entries.push({
        label: opts.stopLabel || 'Stop',
        icon: 'codicon-debug-stop',
        onClick: opts.onStop,
      });
    } else if (!paused) {
      entries.push({
        label: 'Pause',
        icon: 'codicon-debug-pause',
        disabled: opts.canPause !== true,
        onClick: opts.onPause,
      });
    }
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
