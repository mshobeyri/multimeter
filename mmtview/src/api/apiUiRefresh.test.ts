import { APIData } from "mmt-core/APIData";
import { Request } from "mmt-core/NetworkData";
import {
  ApiUiRefreshScope,
  applyScopedRequestData,
  diffApiRefreshScopes,
  isDocOnlyRefresh,
  requestFieldsForScopes,
} from "./apiUiRefresh";

describe("apiUiRefresh", () => {
  const baseApi = {
    type: "api",
    url: "https://example.com/${e:host}",
    method: "get",
    body: '{"a":1}',
    headers: { Authorization: "${e:token}" },
    description: "hello",
  } as APIData;

  test("diffApiRefreshScopes returns all on first load", () => {
    expect(diffApiRefreshScopes(undefined, baseApi)).toEqual(["all"]);
  });

  test("diffApiRefreshScopes isolates url changes", () => {
    const next = { ...baseApi, url: "https://other.com" };
    expect(diffApiRefreshScopes(baseApi, next)).toEqual(["url"]);
  });

  test("diffApiRefreshScopes isolates body changes", () => {
    const next = { ...baseApi, body: '{"a":2}' };
    expect(diffApiRefreshScopes(baseApi, next)).toEqual(["body"]);
  });

  test("diffApiRefreshScopes isolates doc changes", () => {
    const next = { ...baseApi, description: "updated" };
    expect(diffApiRefreshScopes(baseApi, next)).toEqual(["doc"]);
    expect(isDocOnlyRefresh(["doc"])).toBe(true);
  });

  test("diffApiRefreshScopes promotes inputs to all", () => {
    const next = { ...baseApi, inputs: { id: 1 } };
    expect(diffApiRefreshScopes(baseApi, next)).toEqual(["all"]);
  });

  test("diffApiRefreshScopes isolates examples changes without rebuilding request", () => {
    const next = { ...baseApi, examples: [{ name: "example", inputs: { id: 1 } }] };
    expect(diffApiRefreshScopes(baseApi, next)).toEqual(["examples"]);
    expect(isDocOnlyRefresh(["examples"])).toBe(true);
  });

  test("requestFieldsForScopes expands env to token-bearing fields", () => {
    expect(requestFieldsForScopes(["env"])).toEqual(
      expect.arrayContaining(["url", "body", "headers", "query", "cookies"])
    );
  });

  test("applyScopedRequestData patches only scoped fields and skips unchanged", () => {
    const prev: Request = {
      url: "https://example.com/old",
      body: '{"a":1}',
      headers: { Authorization: "old" },
      method: "get",
    };
    const generated: Request = {
      url: "https://example.com/new",
      body: '{"a":1}',
      headers: { Authorization: "new" },
      method: "post",
    };

    const next = applyScopedRequestData(prev, generated, ["url"], new Set(), true);
    expect(next.url).toBe("https://example.com/new");
    expect(next.body).toBe('{"a":1}');
    expect(next.headers).toEqual({ Authorization: "old" });
    expect(next.method).toBe("get");
  });

  test("applyScopedRequestData respects touched fields", () => {
    const prev: Request = { url: "user-edited", body: "keep" };
    const generated: Request = { url: "from-yaml", body: "from-yaml" };
    const next = applyScopedRequestData(
      prev,
      generated,
      ["url", "body"],
      new Set<keyof Request>(["url"]),
      true
    );
    expect(next.url).toBe("user-edited");
    expect(next.body).toBe("from-yaml");
  });

  test("applyScopedRequestData env scope does not rewrite untouched meta", () => {
    const prev: Request = {
      url: "https://a",
      method: "get",
      body: "x",
    };
    const generated: Request = {
      url: "https://b",
      method: "post",
      body: "y",
    };
    const next = applyScopedRequestData(prev, generated, ["env"], new Set(), true);
    expect(next.url).toBe("https://b");
    expect(next.body).toBe("y");
    expect(next.method).toBe("get");
  });
});
