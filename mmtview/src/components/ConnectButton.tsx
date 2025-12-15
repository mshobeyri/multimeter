import React, { useState } from "react";

const ConnectButton: React.FC<{
  connected: boolean;
  onClick: () => void;
}> = ({ connected, onClick }) => {
  const [hover, setHover] = useState(false);

  return (
    <button
      style={{
        background: connected
          ? hover
            ? "#2e7d32"
            : "#43a047"
          : hover
            ? "#c94444"
            : "#b03a3a",
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
        marginRight: "8px",
        transition: "background 0.2s"
      }}
      title={connected ? "Disconnect" : "Connect"}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {connected ? (
        <span
          className="codicon codicon-plug"
          style={{
            fontSize: "16px",
            color: "#fff"
          }}
        ></span>
      ) : (
        <span
          className="codicon codicon-debug-disconnect"
          style={{
            fontSize: "16px",
            color: "#fff"
          }}
        ></span>
      )}
    </button>
  );
};

export default ConnectButton;