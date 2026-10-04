import { useEffect } from "react";

/** Cmd+Enter on macOS, Ctrl+Enter elsewhere. */
export function sendShortcutLabel(): string {
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  return /mac/i.test(platform) ? "⌘Enter" : "Ctrl+Enter";
}

type Action = () => void;

let current: Action | null = null;
let lastInvokeAt = 0;

export function hasPrimaryAction(): boolean {
  return current != null;
}

/** Run the open file's Send or Run action. Ignores a second call from key repeat. */
export function invokePrimaryAction(): void {
  const now = Date.now();
  if (now - lastInvokeAt < 300) {
    return;
  }
  lastInvokeAt = now;
  current?.();
}

/** The visible panel registers the action Cmd/Ctrl+Enter should run. */
export function usePrimaryAction(action: Action | null): void {
  useEffect(() => {
    if (!action) {
      return;
    }
    current = action;
    return () => {
      if (current === action) {
        current = null;
      }
    };
  }, [action]);
}
