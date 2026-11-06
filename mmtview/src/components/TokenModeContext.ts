import { createContext, useContext } from "react";

/** Edit = tokens; telescope = resolved mirror; sandbox = resolved literals (no YAML). */
export type TokenDisplayMode = "tokens" | "resolved" | "sandbox";

/** Telescope / token-mirror / sandbox state for request fields. */
export type TokenModeState = {
  mode: TokenDisplayMode;
  /**
   * Bumps when frozen r:/c: field-preview samples are re-seeded
   * (open, telescope on, or Send — including when telescope is off).
   */
  previewEpoch: number;
};

const DEFAULT_TOKEN_MODE: TokenModeState = {
  mode: "resolved",
  previewEpoch: 0,
};

/** Global request-side token display mode; token fields follow it. */
export const TokenModeContext = createContext<TokenModeState>(DEFAULT_TOKEN_MODE);

export const useTokenMode = (): TokenDisplayMode =>
  useContext(TokenModeContext).mode;

export const useTokenPreviewEpoch = (): number =>
  useContext(TokenModeContext).previewEpoch;
