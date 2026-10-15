import { APIData } from "mmt-core/APIData";
import { JSONRecord } from "mmt-core/CommonData";
import { Request } from "mmt-core/NetworkData";
import { buildApiTesterSendRequest } from "mmt-core/apiBodyEdit";
import { apiToYaml } from "mmt-core/apiParsePack";
import { resolveApiHttpMethod } from "mmt-core/apiMethod";
import {
  setGitCurrentSnapshot,
  textMayNeedGitCurrentSnapshot,
  type GitCurrentSnapshot,
} from "mmt-core/Current";
import { protocolResolver } from "mmt-core";

/** Resolves `null` on timeout / no reply (keep the previous snapshot). */
export type GitSnapshotRequester =
  () => Promise<GitCurrentSnapshot | undefined | null>;

/**
 * Serialize the live-synced API YAML model for Send / Run in Core.
 * No resolved-token overlay — same outcome as running the file (glyph).
 */
export function buildYamlRawFile(api: APIData): string {
  let merged = api;
  const effectiveProtocol = protocolResolver.getEffectiveProtocol(
    merged.protocol, merged.url);
  if (effectiveProtocol === "http" && !merged.method) {
    merged = {
      ...merged,
      method: resolveApiHttpMethod(undefined, merged.body),
    };
  }
  return apiToYaml(merged);
}

/** Apply the snapshot carried by `viewDocumentContent` (missing → empty). */
export function applyViewDocumentGitSnapshot(message: { gitSnapshot?: unknown }): void {
  if (message.gitSnapshot && typeof message.gitSnapshot === "object") {
    setGitCurrentSnapshot(message.gitSnapshot as GitCurrentSnapshot);
  } else {
    setGitCurrentSnapshot(undefined);
  }
}

/**
 * Fetch live git metadata from the extension before minting r:/c: so
 * `c:git_*` resolves with the other tokens (the snapshot from document open
 * may be missing or stale). Keeps the previous snapshot on timeout.
 */
export async function refreshGitSnapshotFor(
  api: APIData,
  requestGitSnapshot: GitSnapshotRequester,
): Promise<void> {
  let text: string;
  try {
    text = JSON.stringify(api);
  } catch {
    return;
  }
  if (!textMayNeedGitCurrentSnapshot(text)) {
    return;
  }
  const snapshot = await requestGitSnapshot();
  if (snapshot !== null) {
    setGitCurrentSnapshot(snapshot);
  }
}

/** Refresh git, then mint the Send snapshot (wire request + telescope seed). */
export async function prepareApiTesterSend(
  api: APIData,
  inputs: JSONRecord,
  env: JSONRecord,
  requestGitSnapshot: GitSnapshotRequester,
): Promise<{ resolved: Request; sendRequest: Request }> {
  await refreshGitSnapshotFor(api, requestGitSnapshot);
  return buildApiTesterSendRequest(api, inputs, env);
}

/** `runCurrentDocument` payload for API Tester Send / Run in Core. */
export function buildApiTesterRunMessage(opts: {
  api: APIData;
  forSend: boolean;
  exampleIndex?: number;
  manualInputs: JSONRecord;
  resolvedRequest?: Request;
}): Record<string, unknown> {
  return {
    command: "runCurrentDocument",
    report: { type: "lifecycle" },
    // History panel only for API Tester Send — not glyph / Run in Core.
    history: opts.forSend === true,
    rawFile: buildYamlRawFile(opts.api),
    inputs: {
      exampleIndex: opts.exampleIndex,
      manualInputs: opts.manualInputs,
    },
    ...(opts.forSend && opts.resolvedRequest
      ? { resolvedRequest: opts.resolvedRequest }
      : {}),
  };
}
