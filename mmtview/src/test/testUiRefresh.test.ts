import {
  applyEnvRefreshToInputs,
  applyYamlInputsRefresh,
  computeDirtyInputKeys,
  resolveInputDefaults,
} from "./testUiRefresh";

describe("testUiRefresh", () => {
  test("resolveInputDefaults resolves e: tokens", () => {
    expect(resolveInputDefaults(
      { host: "e:HOST", n: 1 },
      { HOST: "localhost" },
    )).toEqual({ host: "localhost", n: 1 });
  });

  test("resolveInputDefaults composes sibling i: refs and accessors", () => {
    expect(resolveInputDefaults(
      {
        card: "e:card",
        seq: "e:seq",
        short: "<<i:card[0:4]>>",
        id: "<<i:short>>_<<i:seq>>",
      },
      { card: "4111111111111111", seq: "42" },
    )).toEqual({
      card: "4111111111111111",
      seq: "42",
      short: "4111",
      id: "4111_42",
    });
  });

  test("applyEnvRefreshToInputs skips dirty keys", () => {
    const prev = { host: "stale", user: "edited" };
    const next = applyEnvRefreshToInputs(
      prev,
      { host: "e:HOST", user: "e:USER" },
      { HOST: "localhost", USER: "alice" },
      new Set(["user"]),
    );
    expect(next).toEqual({ host: "localhost", user: "edited" });
  });

  test("applyEnvRefreshToInputs returns prev when unchanged", () => {
    const prev = { host: "localhost" };
    const next = applyEnvRefreshToInputs(
      prev,
      { host: "e:HOST" },
      { HOST: "localhost" },
      new Set(),
    );
    expect(next).toBe(prev);
  });

  test("applyYamlInputsRefresh forceReset replaces all", () => {
    const next = applyYamlInputsRefresh(
      { host: "edited", gone: 1 },
      { host: "e:HOST", port: 80 },
      { HOST: "localhost" },
      new Set(["host"]),
      true,
    );
    expect(next).toEqual({ host: "localhost", port: 80 });
  });

  test("applyYamlInputsRefresh preserves dirty keys", () => {
    const next = applyYamlInputsRefresh(
      { host: "edited", port: 9 },
      { host: "e:HOST", port: 80 },
      { HOST: "localhost" },
      new Set(["host"]),
      false,
    );
    expect(next).toEqual({ host: "edited", port: 80 });
  });

  test("computeDirtyInputKeys compares against resolved baseline", () => {
    const baseline = { host: "localhost", user: "alice" };
    expect(computeDirtyInputKeys(
      { host: "localhost", user: "alice" },
      baseline,
    ).size).toBe(0);
    expect(Array.from(computeDirtyInputKeys(
      { host: "localhost", user: "bob" },
      baseline,
    ))).toEqual(["user"]);
  });
});
