import React from 'react';

interface ResponseStatusProps {
  status?: number;
  errorMessage?: string;
  errorCode?: string | number;
  className?: string;
}

const ResponseStatus: React.FC<ResponseStatusProps> = ({ status, errorMessage, errorCode, className }) => {
  if (errorMessage) {
    return (
      <div
        className={`response-badge ${className || ''}`.trim()}
        style={{
          backgroundColor: '#d32f2f',
        }}
        title={`${errorMessage}${status ? ` (Status: ${status})` : ''}${errorCode ? ` (Code: ${errorCode})` : ''}`}
      >
        {status || errorCode || 'ERROR'}
      </div>
    );
  }
  if (status && status > 0) {
    return (
      <div
        className={`response-badge ${className || ''}`.trim()}
        style={{
          backgroundColor: '#4caf50',
          color: 'white',
        }}
        title="Request successful"
      >
        {status}
      </div>
    );
  }
  return null;
};

export default ResponseStatus;