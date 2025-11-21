import React from 'react';

interface ResponseDurationProps {
  duration?: number;
  className?: string;
}

const ResponseDuration: React.FC<ResponseDurationProps> = ({ duration, className }) => {
  if (duration == null || duration < 0) return null;
  return (
    <div
      className={className}
      style={{
        padding: '2px 4px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        minWidth: '20px'
      }}
      title={`Duration: ${duration}ms`}
    >
      {duration}ms
    </div>
  );
};

export default ResponseDuration;