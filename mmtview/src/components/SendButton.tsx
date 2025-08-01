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
          ? "#7a7979"
          : hover
            ? "#2e7d32"
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
              stroke="#fff"
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
      <span
        className="codicon codicon-send"
        style={{
          fontSize: "16px",
          zIndex: 2,
          color: "#fff",
          marginLeft: "4px"
        }}
      ></span>
    </button>
  );
};

export default SendButton;