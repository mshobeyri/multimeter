import type {FileLoader} from './JSerFileLoader';

export interface TestFileLoaderMock {
  fileLoader: FileLoader;
  set: (path: string, content: string) => void;
  get: (path: string) => string | undefined;
  paths: () => string[];
}

export const createTestFileLoaderMock = (initial?: Record<string, string>): TestFileLoaderMock => {
  const store = new Map<string, string>(Object.entries(initial || {}));
  return {
    fileLoader: async (path: string) => {
      return store.get(path) ?? '';
    },
    set: (path: string, content: string) => {
      store.set(path, content);
    },
    get: (path: string) => store.get(path),
    paths: () => Array.from(store.keys()),
  };
};
