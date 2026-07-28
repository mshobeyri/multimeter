import React, { useEffect, useMemo, useState } from "react";
import { accentChromeFor } from "../shared/themeAccent";

const ConnectButton: React.FC<{
  connected: boolean;
  onClick: () => void;
}> = ({ connected, onClick }) => {
  const [hover, setHover] = useState(false);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const onTheme = () => setThemeTick((n) => n + 1);
    window.addEventListener("vscode:changeColorTheme", onTheme as EventListener);
    return () => window.removeEventListener("vscode:changeColorTheme", onTheme as EventListener);
  }, []);

  const chrome = useMemo(
    () => accentChromeFor(connected ? "green" : "red", {
      fillAmount: hover ? 62 : 52,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected, hover, themeTick],
  );

  return (
    <button
      style={{
        background: chrome.fill,
        color: chrome.onFill,
        border: `1px solid ${chrome.border}`,
        borderRadius: "50%",
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: chrome.outline ? "none" : "0 2px 6px #0001",
        padding: 0,
        marginRight: "8px",
        transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
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
            color: chrome.onFill,
          }}
        ></span>
      ) : (
        <span
          className="codicon codicon-debug-disconnect"
          style={{
            fontSize: "16px",
            color: chrome.onFill,
          }}
        ></span>
      )}
    </button>
  );
};

export default ConnectButton;
