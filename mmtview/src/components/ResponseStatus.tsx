import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAccentChrome } from '../shared/useAccentChrome';
import { AccentChrome, harmonizeAccent } from '../shared/themeAccent';

interface ResponseStatusProps {
  status?: number;
  errorMessage?: string;
  errorCode?: string | number;
  warning?: string;
  protocol?: 'http' | 'ws' | 'graphql' | 'grpc';
  className?: string;
  onClick?: () => void;
}

type BadgeStyle = {
  backgroundColor: string;
  color?: string;
  border?: string;
};

const MAX_BADGE_TEXT_LENGTH = 20;
const WARNING_ACCENT = '#f8b449';
const REDIRECT_ACCENT = '#f2f82c';

function compactBadgeLabel(label: string | number): string | number {
  if (typeof label === 'string' && label.length > MAX_BADGE_TEXT_LENGTH) {
    return 'ERROR';
  }
  return label;
}

function chromeToBadge(chrome: AccentChrome, colorOverride?: string): BadgeStyle {
  return {
    backgroundColor: chrome.fill,
    color: colorOverride || chrome.onFill,
    border: `1px solid ${chrome.border}`,
  };
}

function getResponseStatusStyle(
    status: number | undefined,
    warning: string | undefined,
    success: AccentChrome,
    error: AccentChrome,
    warningChrome: AccentChrome,
    redirectChrome: AccentChrome,
): BadgeStyle {
  if (typeof status === 'number' && status < 0) {
    return chromeToBadge(error);
  }

  if (warning && typeof status === 'number' && status < 400) {
    return chromeToBadge(warningChrome, 'black');
  }

  if (status === 200) {
    return chromeToBadge(success);
  }

  if (typeof status === 'number' && status > 200 && status < 300) {
    return {
      backgroundColor: success.softFill,
      color: success.text,
      border: `1px solid ${success.border}`,
    };
  }

  if (typeof status === 'number' && ((status > 300 && status < 400) || (status > 100 && status < 199))) {
    return chromeToBadge(redirectChrome, 'black');
  }

  return chromeToBadge(error);
}

function getHTTPResponseStatusTitle(
    status: number | undefined,
    errorMessage: string | undefined,
    errorCode: string | number | undefined,
    warning?: string,
): {title: string; label: string | number} {
  if (typeof status === 'number' && status < 0) {
    const label = errorMessage || 'ERROR';
    return {title: errorMessage || 'Request failed', label: compactBadgeLabel(label)};
  }

  if (status === 200) {
    return {title: warning || 'Request successful', label: status};
  }

  const maybeStatus = typeof status === 'number' ? ` (Status: ${status})` : '';
  const maybeCode = errorCode ? ` (Code: ${errorCode})` : '';
  const title = `${warning || errorMessage || ''}${maybeStatus}${maybeCode}`.trim() || 'ERROR';

  return {title, label: status ?? errorCode ?? 'ERROR'};
}

function getWSResponseStatusTitle(
    status: number | undefined,
    errorMessage: string | undefined,
    errorCode: string | number | undefined,
): {title: string; label: string | number} {
  if (typeof status === 'number' && status < 0) {
    const label = errorMessage || 'ERROR';
    return {title: errorMessage || 'WebSocket error', label: compactBadgeLabel(label)};
  }

  if (status === 101) {
    return {title: 'WebSocket connected', label: 101};
  }

  if (typeof status === 'number' && status >= 1000) {
    const reason = errorMessage ? `: ${errorMessage}` : '';
    return {title: `WebSocket closed (${status})${reason}`, label: status};
  }

  if (status === 204) {
    return {title: 'WebSocket message received', label: 'MSG'};
  }

  const maybeStatus = typeof status === 'number' ? ` (Status: ${status})` : '';
  const maybeCode = errorCode ? ` (Code: ${errorCode})` : '';
  const title = `${errorMessage || ''}${maybeStatus}${maybeCode}`.trim() || 'WebSocket response';

  return {title, label: status ?? errorCode ?? 'WS'};
}

const ResponseStatus: React.FC<ResponseStatusProps> = ({
  status,
  errorMessage,
  errorCode,
  warning,
  protocol,
  className,
  onClick,
}) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipPos, setTipPos] = useState({ bottom: 0, right: 0 });
  const successChrome = useAccentChrome('green');
  const errorChrome = useAccentChrome('red');
  const warningChrome = useMemo(
      () => harmonizeAccent(WARNING_ACCENT),
      // successChrome.accent changes when theme surfaces refresh via sibling hooks
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [successChrome.accent, successChrome.fill],
  );
  const redirectChrome = useMemo(
      () => harmonizeAccent(REDIRECT_ACCENT),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [successChrome.accent, successChrome.fill],
  );
  const style = getResponseStatusStyle(
      status, warning, successChrome, errorChrome, warningChrome, redirectChrome);
  const {title, label} =
      protocol === 'ws'
          ? getWSResponseStatusTitle(status, errorMessage, errorCode)
          : getHTTPResponseStatusTitle(status, errorMessage, errorCode, warning);

  const showTip = () => {
    if (!title) {
      return;
    }
    const el = badgeRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    setTipPos({
      bottom: window.innerHeight - rect.top + 6,
      right: window.innerWidth - rect.right,
    });
    setTipOpen(true);
  };

  const hideTip = () => setTipOpen(false);

  return (
    <div
      ref={badgeRef}
      className={`response-badge ${onClick ? 'response-badge--clickable' : ''} ${className || ''}`.trim()}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
      {tipOpen && title
        ? createPortal(
            <span
              className="response-badge-tooltip"
              style={{
                right: tipPos.right,
                bottom: tipPos.bottom,
              }}
            >
              {title}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
};

export default ResponseStatus;
