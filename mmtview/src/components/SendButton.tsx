import React, { useState } from "react";

const SendButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}> = ({ onClick, disabled, loading }) => {
  const [hover, setHover] = useState(false);

  return (
    <button
      style={{
        position: "absolute",
        right: "16px",
        top: "50%",
        transform: "translateY(-50%)",
        background: disabled
          ? "#bdbdbd"
          : hover
          ? "#388e3c"
          : "#43a047",
        color: "#fff",
        border: "none",
        borderRadius: "50%",
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 2px 6px #0001",
        padding: 0,
        outline: "none"
      }}
      title="Send"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {loading && (
        <span
          style={{
            position: "absolute",
            width: 38,
            height: 38,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            style={{
              animation: "spin 1s linear infinite"
            }}
          >
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="#fff" // changed from #1976d2 to white
              strokeWidth="3"
              strokeDasharray="40"
              strokeDashoffset="10"
              strokeLinecap="round"
              opacity="0.7"
            />
            <style>
              {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
            </style>
          </svg>
        </span>
      )}
      <svg
        fill="#fff"
        viewBox="0 0 256 256"
        width="15.4"
        height="15.4"
        xmlns="http://www.w3.org/2000/svg"
        style={{ marginLeft: "4px", zIndex: 2 }}
      >
        <path d="M225.39844,110.5498,56.4834,15.957A20,20,0,0,0,27.877,40.13477L59.25781,128,27.877,215.86621A19.97134,19.97134,0,0,0,56.48437,240.042L225.39844,145.4502a19.99958,19.99958,0,0,0,0-34.9004ZM54.06738,213.88867,80.45605,140H136a12,12,0,0,0,0-24H80.45654L54.06738,42.11133,207.44043,128Z"></path>
      </svg>
    </button>
  );
};

export default SendButton;