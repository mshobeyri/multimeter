import {
  cacheBodyAutoFormat,
  readCachedBodyAutoFormat,
  requestEditorConfig,
} from "./bodyAutoFormatConfig";

describe("bodyAutoFormatConfig", () => {
  const win = () => (global as any).window;

  beforeEach(() => {
    (global as any).window = { vscode: { postMessage: jest.fn() } };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  test("reads false when no config message has arrived yet", () => {
    expect(readCachedBodyAutoFormat()).toBe(false);
  });

  test("panels mounting after the config message read the cached value", () => {
    cacheBodyAutoFormat(true);
    expect(readCachedBodyAutoFormat()).toBe(true);
    cacheBodyAutoFormat(false);
    expect(readCachedBodyAutoFormat()).toBe(false);
  });

  test("requestEditorConfig asks the extension to resend the config", () => {
    requestEditorConfig();
    expect(win().vscode.postMessage).toHaveBeenCalledWith({
      command: "requestConfig",
    });
  });

  test("requestEditorConfig is a no-op without the vscode bridge", () => {
    delete (global as any).window.vscode;
    expect(() => requestEditorConfig()).not.toThrow();
  });
});
