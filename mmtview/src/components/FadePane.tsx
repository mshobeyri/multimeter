import React, { useEffect, useRef, useState } from "react";

type FadePaneProps = {
  /** When this changes, current content fades out, then the new content fades in. */
  paneKey: string;
  className?: string;
  children: React.ReactNode;
  /** Fade-out / fade-in duration (ms) each. */
  durationMs?: number;
};

/**
 * Fade-out → swap → fade-in for tab panels and edit/view bodies.
 * Previous content stays mounted through fade-out; parent `.apitest-pane-fill`
 * pins height so swaps do not jump.
 */
const FadePane: React.FC<FadePaneProps> = ({
  paneKey,
  className,
  children,
  durationMs = 100,
}) => {
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const renderedKeyRef = useRef(paneKey);
  const [rendered, setRendered] = useState(children);
  const [visible, setVisible] = useState(true);

  // Same-key updates stay live; do not overwrite mid-fade.
  useEffect(() => {
    if (paneKey !== renderedKeyRef.current) {
      return;
    }
    setRendered(children);
  }, [children, paneKey]);

  useEffect(() => {
    if (paneKey === renderedKeyRef.current) {
      return;
    }

    let cancelled = false;
    setVisible(false);

    const fadeOutTimer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      renderedKeyRef.current = paneKey;
      setRendered(childrenRef.current);
      // Ensure the browser paints opacity 0 before fading in.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }
          setVisible(true);
        });
      });
    }, durationMs);

    return () => {
      cancelled = true;
      window.clearTimeout(fadeOutTimer);
    };
  }, [paneKey, durationMs]);

  return (
    <div
      className={[
        "apitest-fade-pane",
        visible ? "is-in" : "is-out",
        className,
      ].filter(Boolean).join(" ")}
      style={{ ["--apitest-fade-ms" as string]: `${durationMs}ms` }}
    >
      {rendered}
    </div>
  );
};

export default FadePane;
