import React from 'react';

interface ResponseStatusProps {
  status?: number;
  errorMessage?: string;
  errorCode?: string | number;
  className?: string;
}

const ResponseStatus: React.FC<ResponseStatusProps> = ({ status, errorMessage, errorCode, className }) => {

  if (status == 200) {
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
  else if (status && status > 200 && status < 300) {
    return (
      <div
        className={`response-badge ${className || ''}`.trim()}
        style={{
          backgroundColor: '#abf384',
          color: 'black',
        }}
        title={`${errorMessage}${status ? ` (Status: ${status})` : ''}${errorCode ? ` (Code: ${errorCode})` : ''}`}
      >
        {status}
      </div>
    );
  } else if (status && ((status > 300 && status < 400) || (status > 100 && status < 199))) {
    return (
      <div
        className={`response-badge ${className || ''}`.trim()}
        style={{
          backgroundColor: '#f2f82cff',
          color: 'black',
        }}
        title={`${errorMessage}${status ? ` (Status: ${status})` : ''}${errorCode ? ` (Code: ${errorCode})` : ''}`}
      >
        {status}
      </div>
    );
  } else {
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
};

export default ResponseStatus;