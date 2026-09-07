import React from 'react';
import PrimaryButton from './PrimaryButton';
import ContextMenuHost, { ContextMenuItem } from './ContextMenuHost';

export type RunStopToggleProps = {
  running: boolean;
  /**
   * Local prep before the host run starts (yaml serialize, hierarchy fetch, …).
   * Shows a non-reentrant Starting control so the user does not click Run again.
   */
  preparing?: boolean;
  onRun: () => void | Promise<void>;
  onStop: () => void;
  /** Label while idle. Default "Run". */
  runLabel?: string;
  /** Label while preparing. Default "Starting…". */
  preparingLabel?: string;
  /** Label while running. Default "Stop". */
  stopLabel?: string;
  runTitle?: string;
  preparingTitle?: string;
  stopTitle?: string;
  disabled?: boolean;
  /** Optional right-click menu on the Run control (e.g. Run in Core). */
  runContextMenuItems?: ContextMenuItem[];
};

/**
 * Shared Run ↔ Starting ↔ Stop primary control used on test / suite / mock run pages.
 */
export default function RunStopToggle({
  running,
  preparing = false,
  onRun,
  onStop,
  runLabel = 'Run',
  preparingLabel = 'Starting…',
  stopLabel = 'Stop',
  runTitle,
  preparingTitle,
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

  if (preparing) {
    return (
      <PrimaryButton
        className="run-toggle-button"
        icon="loading"
        iconSpin
        disabled
        title={preparingTitle || preparingLabel}
      >
        {preparingLabel}
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
