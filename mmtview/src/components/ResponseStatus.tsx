import React from 'react';

interface ResponseStatusProps {
  status?: number;
  errorMessage?: string;
  errorCode?: string | number;
  protocol?: 'http' | 'ws' | 'graphql' | 'grpc';
  className?: string;
}

type BadgeStyle = {
  backgroundColor: string;
  color?: string;
};

function getResponseStatusStyle(status: number | undefined): BadgeStyle {
  if (typeof status === 'number' && status < 0) {
    return {backgroundColor: '#d32f2f'};
  }

  if (status === 200) {
    return {backgroundColor: '#23d18b', color: 'white'};
  }

  if (typeof status === 'number' && status > 200 && status < 300) {
    return {backgroundColor: '#abf384', color: 'black'};
  }

  if (typeof status === 'number' && ((status > 300 && status < 400) || (status > 100 && status < 199))) {
    return {backgroundColor: '#f2f82c', color: 'black'};
  }

  return {backgroundColor: '#d32f2f'};
}

function getHTTPResponseStatusTitle(
    status: number | undefined,
    errorMessage: string | undefined,
    errorCode: string | number | undefined,
): {title: string; label: string | number} {
  if (typeof status === 'number' && status < 0) {
    return {title: errorMessage || 'Request failed', label: errorMessage || 'ERROR'};
  }

  if (status === 200) {
    return {title: 'Request successful', label: status};
  }

  const maybeStatus = typeof status === 'number' ? ` (Status: ${status})` : '';
  const maybeCode = errorCode ? ` (Code: ${errorCode})` : '';
  const title = `${errorMessage || ''}${maybeStatus}${maybeCode}`.trim() || 'ERROR';

  return {title, label: status ?? errorCode ?? 'ERROR'};
}

function getWSResponseStatusTitle(
    status: number | undefined,
    errorMessage: string | undefined,
    errorCode: string | number | undefined,
): {title: string; label: string | number} {
  if (typeof status === 'number' && status < 0) {
    return {title: errorMessage || 'WebSocket error', label: errorMessage || 'ERROR'};
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

const ResponseStatus: React.FC<ResponseStatusProps> = ({ status, errorMessage, errorCode, protocol, className }) => {
  const style = getResponseStatusStyle(status);
  const {title, label} =
      protocol === 'ws'
          ? getWSResponseStatusTitle(status, errorMessage, errorCode)
          : getHTTPResponseStatusTitle(status, errorMessage, errorCode);

  return (
    <div
      className={`response-badge ${className || ''}`.trim()}
      style={style}
      title={title}
    >
      {label}
    </div>
  );
};

export default ResponseStatus;