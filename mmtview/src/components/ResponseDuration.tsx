import React from 'react';

interface ResponseDurationProps {
  duration?: number;
  className?: string;
}

const ResponseDuration: React.FC<ResponseDurationProps> = ({ duration, className }) => {
  if (duration == null || duration < 0) return null;
  const ms = Math.round(duration);
  return (
    <div
      className={`response-badge ${className || ''}`.trim()}
      style={{ minWidth: '20px' }}
      title={`Duration: ${ms}ms`}
    >
      {ms}ms
    </div>
  );
};

export default ResponseDuration;