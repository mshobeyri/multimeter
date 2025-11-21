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
        className={className}
        style={{
          backgroundColor: '#d32f2f',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          minWidth: '20px',
          textAlign: 'center'
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
        className={className}
        style={{
          backgroundColor: '#4caf50',
          color: 'white',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          minWidth: '40px',
          textAlign: 'center'
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