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
 * Run ▾ menu for test/suite: primary actions, then an Export heading with formats
 * (same heading pattern as the body format RAW / YAML-encoded groups).
 */
export function buildReportRunMenuEntries(opts: {
  onRunInCore: () => void | Promise<void>;
  runInCoreDisabled?: boolean;
  onClear: () => void;
  clearDisabled?: boolean;
  onExport: (format: ReportFormat) => void;
  exportDisabled?: boolean;
}): SendButtonMenuEntry[] {
  return [
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
  ];
}
