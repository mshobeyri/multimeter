import React from "react";

const SendButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    style={{
      position: "absolute",
      right: "16px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "#43a047",
      color: "#fff",
      border: "none",
      borderRadius: "50%",
      width: 30,
      height: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: "0 2px 6px #0001",
      padding: 0,
    }}
    title="Send"
    onClick={onClick}
  >
    <svg
      fill="#fff"
      viewBox="0 0 256 256"
      width="15.4"
      height="15.4"
      xmlns="http://www.w3.org/2000/svg"
      style={{ marginLeft: "4px" }}
    >
      <path d="M225.39844,110.5498,56.4834,15.957A20,20,0,0,0,27.877,40.13477L59.25781,128,27.877,215.86621A19.97134,19.97134,0,0,0,56.48437,240.042L225.39844,145.4502a19.99958,19.99958,0,0,0,0-34.9004ZM54.06738,213.88867,80.45605,140H136a12,12,0,0,0,0-24H80.45654L54.06738,42.11133,207.44043,128Z"></path>
    </svg>
  </button>
);

export default SendButton;