import React from 'react';
import { statusIcons } from 'mmt-core';
import { aggregateStepStatuses } from 'mmt-core/suite/suiteItemStatus';
import { PAUSE_CIRCLE_ICON, StatusGlyph } from '../components/StatusGlyph';
import { StepStatus } from './types';

export const statusIconFor = (status: StepStatus | 'paused') => {
    if (status === 'paused') {
        return { icon: PAUSE_CIRCLE_ICON, color: '#d29922', title: 'Paused' };
    }
    if (status === 'running') {
        return { icon: 'codicon-play-circle', color: '#0ABAB5', title: 'Running' };
    }
    if (status === 'cancelled') {
        return { icon: 'codicon-stop-circle', color: '#7c4545', title: 'Stopped' };
    }
    if (status === 'passed') {
        return { icon: 'codicon-pass', color: '#23d18b', title: 'Passed' };
    }
    if (status === 'failed') {
        return { icon: 'codicon-error', color: '#f85149', title: 'Failed' };
    }
    if (status === 'invalid') {
        return { icon: 'codicon-warning', color: '#f8b449', title: 'Error' };
    }
    if (status === 'pending') {
        return { icon: 'codicon-clockface', color: '#6d8974', title: 'Pending' };
    }
    if (status === 'skipped') {
        return { icon: 'codicon-skip', color: '#7c847e', title: 'Skipped' };
    }
    if (status === 'debug') {
        return { icon: 'codicon-debug', color: '#8973ea', title: 'Debug' };
    }
    return { icon: 'codicon-circle-large', color: '#c5c5c5', title: 'Default' };
};

/** Status icon; when `cached`, uses db_pass / db_error instead of the normal pass/fail glyphs. */
export const StatusIconWithCache: React.FC<{
  status: StepStatus;
  cached?: boolean;
  /** When true, running status shows the pause glyph instead of play. */
  paused?: boolean;
  fontSize?: number | string;
  style?: React.CSSProperties;
}> = ({ status, cached, paused, fontSize, style }) => {
  const meta = paused && status === 'running'
    ? statusIconFor('paused')
    : statusIconFor(status);
  const useDbIcon = cached === true && (status === 'passed' || status === 'failed');
  const label = useDbIcon ? `${meta.title} (served from cache)` : meta.title;
  const size = fontSize ?? '1em';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        color: meta.color,
        fontSize: size,
        width: '1em',
        height: '1em',
        ...style,
      }}
      title={label}
      aria-label={label}
    >
      {useDbIcon ? (
        <span
          style={{ display: 'inline-flex', width: '1em', height: '1em' }}
          dangerouslySetInnerHTML={{
            __html: status === 'passed' ? statusIcons.DB_PASS_SVG : statusIcons.DB_ERROR_SVG,
          }}
        />
      ) : (
        <StatusGlyph icon={meta.icon} color={meta.color} />
      )}
    </span>
  );
};

/** Shared with core suite rollup (`aggregateStepStatuses`). */
export const aggregateStatuses = (statuses: Array<StepStatus | undefined | null>): StepStatus => {
    return aggregateStepStatuses(statuses) as StepStatus;
};
