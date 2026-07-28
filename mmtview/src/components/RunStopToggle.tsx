import React from 'react';
import PrimaryButton from './PrimaryButton';
import ContextMenuHost, { ContextMenuItem } from './ContextMenuHost';

export type RunStopToggleProps = {
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  /** Label while idle. Default "Run". */
  runLabel?: string;
  /** Label while running. Default "Stop". */
  stopLabel?: string;
  runTitle?: string;
  stopTitle?: string;
  disabled?: boolean;
  /** Optional right-click menu on the Run control (e.g. Run in Core). */
  runContextMenuItems?: ContextMenuItem[];
};

/**
 * Shared Run ↔ Stop primary control used on test / suite / mock run pages.
 */
export default function RunStopToggle({
  running,
  onRun,
  onStop,
  runLabel = 'Run',
  stopLabel = 'Stop',
  runTitle,
  stopTitle,
  disabled,
  runContextMenuItems,
}: RunStopToggleProps) {
  if (running) {
    return (
      <PrimaryButton
        className="run-toggle-button"
        icon="debug-stop"
        accent="red"
        onClick={onStop}
        title={stopTitle || stopLabel}
      >
        {stopLabel}
      </PrimaryButton>
    );
  }

  const runButton = (
    <PrimaryButton
      className="run-toggle-button"
      icon="run"
      onClick={onRun}
      disabled={disabled}
      title={runTitle || runLabel}
    >
      {runLabel}
    </PrimaryButton>
  );

  if (!runContextMenuItems?.length) {
    return runButton;
  }

  return (
    <ContextMenuHost items={runContextMenuItems}>
      {runButton}
    </ContextMenuHost>
  );
}
