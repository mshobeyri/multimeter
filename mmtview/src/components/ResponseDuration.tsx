import React from 'react';

interface ResponseDurationProps {
  duration?: number;
  className?: string;
}

const ResponseDuration: React.FC<ResponseDurationProps> = ({ duration, className }) => {
  if (duration == null || duration < 0) return null;
  const ms = Math.round(duration);
  return (
    <span
      className={`response-duration ${className || ''}`.trim()}
      title={`Duration: ${ms}ms`}
    >
      {ms}ms
    </span>
  );
};

export default ResponseDuration;