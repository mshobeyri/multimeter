import { createContext, useContext } from "react";

export type TokenDisplayMode = "tokens" | "resolved";

/** Telescope / token-mirror state for request fields. */
export type TokenModeState = {
  mode: TokenDisplayMode;
  /**
   * Bumps when frozen r:/c: field-preview samples are re-seeded
   * (open, telescope on, Send → wire values).
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
