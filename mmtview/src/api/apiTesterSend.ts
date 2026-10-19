import { APIData } from "mmt-core/data/APIData";
import { JSONRecord } from "mmt-core/data/CommonData";
import { Request } from "mmt-core/data/NetworkData";
import { buildApiTesterSendRequest } from "mmt-core/api-edit/apiBodyEdit";
import { apiToYaml } from "mmt-core/parse/apiParsePack";
import { resolveApiHttpMethod } from "mmt-core/network/apiMethod";
import {
  getGitCurrentSnapshot,
  setGitCurrentSnapshot,
  textMayNeedGitCurrentSnapshot,
  type GitCurrentSnapshot,
} from "mmt-core/tokens/Current";
import { resetCurrentTokenCache } from "mmt-core/tokens/variableReplacer";
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

/** True when `api` references a git current token (`c:commit`, `c:branch`, …). */
export function apiNeedsGitCurrentSnapshot(api: APIData): boolean {
  try {
    return textMayNeedGitCurrentSnapshot(JSON.stringify(api));
  } catch {
    return false;
  }
}

/** True when the webview already has a non-empty host git snapshot. */
export function hasLoadedGitCurrentSnapshot(): boolean {
  const snap = getGitCurrentSnapshot();
  if (!snap || typeof snap !== "object") {
    return false;
  }
  return !!(
    snap.commit ||
    snap.commitHash ||
    snap.branch ||
    snap.tag ||
    snap.describe ||
    snap.dirty !== undefined
  );
}

function applyGitSnapshot(snapshot: GitCurrentSnapshot | undefined): void {
  setGitCurrentSnapshot(snapshot);
  // Drop any empty c: values cached before the host snapshot arrived.
  resetCurrentTokenCache();
}

/** Apply the snapshot carried by `viewDocumentContent` (missing → empty). */
export function applyViewDocumentGitSnapshot(message: { gitSnapshot?: unknown }): void {
  if (message.gitSnapshot && typeof message.gitSnapshot === "object") {
    applyGitSnapshot(message.gitSnapshot as GitCurrentSnapshot);
  } else {
    applyGitSnapshot(undefined);
  }
}

/**
 * Fetch live git metadata from the extension before minting r:/c: so
 * git `c:` tokens resolve with the other tokens (the snapshot from document open
 * may be missing or stale). Keeps the previous snapshot on timeout.
 * No-ops when the API has no git `c:` tokens.
 */
export async function refreshGitSnapshotFor(
  api: APIData,
  requestGitSnapshot: GitSnapshotRequester,
): Promise<boolean> {
  if (!apiNeedsGitCurrentSnapshot(api)) {
    return false;
  }
  const snapshot = await requestGitSnapshot();
  if (snapshot !== null) {
    applyGitSnapshot(snapshot);
    return true;
  }
  return false;
}

/**
 * True when the UI should fetch git before resolving: the API needs git `c:`
 * tokens and no usable snapshot is loaded yet (e.g. token typed after open).
 */
export function shouldFetchGitSnapshotForUi(api: APIData): boolean {
  return apiNeedsGitCurrentSnapshot(api) && !hasLoadedGitCurrentSnapshot();
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
