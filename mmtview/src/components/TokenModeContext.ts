import { createContext, useContext } from "react";

export type TokenDisplayMode = "tokens" | "resolved";

/** Global request-side token display mode; token fields follow it. */
export const TokenModeContext = createContext<TokenDisplayMode>("resolved");

export const useTokenMode = (): TokenDisplayMode => useContext(TokenModeContext);
