import { APIData } from "mmt-core/APIData";
import { resolveApiTesterRequest } from "./resolveApiTesterRequest";

describe("resolveApiTesterRequest", () => {
  const api = {
    type: "api",
    url: "https://example.com/echo",
    method: "post",
    format: "json",
    inputs: {},
    body: {
      id: "r:uuid",
      count: "r:int(10,20)",
      created: "c:date",
    },
  } as APIData;

  it("resolves runtime tokens into concrete request values", () => {
    const request = resolveApiTesterRequest(api, {}, {}, { refreshRuntimeTokens: true });
    const body = JSON.parse(String(request.body));
    expect(body.id).toEqual(expect.not.stringMatching(/^r:/));
    expect(body.count).toEqual(expect.any(Number));
    expect(body.created).toEqual(expect.not.stringMatching(/^c:/));
    expect(body.count).toBeGreaterThanOrEqual(10);
    expect(body.count).toBeLessThanOrEqual(20);
  });

  it("refreshes runtime tokens on each send-style resolve", () => {
    const first = resolveApiTesterRequest(api, {}, {}, { refreshRuntimeTokens: true });
    const second = resolveApiTesterRequest(api, {}, {}, { refreshRuntimeTokens: true });
    const firstId = JSON.parse(String(first.body)).id;
    const secondId = JSON.parse(String(second.body)).id;
    expect(firstId).not.toBe("r:uuid");
    expect(secondId).not.toBe("r:uuid");
    expect(firstId).not.toBe(secondId);
  });
});
