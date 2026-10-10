import { useEffect, useMemo, useState } from "react";
import type { JSONRecord } from "mmt-core/CommonData";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import { readEnvironmentVariables } from "../environment/environmentUtils";

/** Loads workspace env vars for token-field preview (Overview / edit pages). */
export function useEnvTokenValueContext(
  inputs?: JSONRecord | null,
): RuntimeTokenValueContext {
  const [env, setEnv] = useState<JSONRecord>({});

  useEffect(() => {
    return readEnvironmentVariables(vars => {
      const next: JSONRecord = {};
      for (const item of vars || []) {
        if (item?.name) {
          next[item.name] = item.value as JSONRecord[string];
        }
      }
      setEnv(next);
    });
  }, []);

  return useMemo(
    () => ({ inputs: inputs || {}, env }),
    [inputs, env],
  );
}
