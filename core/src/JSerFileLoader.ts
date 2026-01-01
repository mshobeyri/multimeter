// File loader type and default implementation
export type FileLoader = (path: string) => Promise<string>;
declare let window: any;
export let readFile: FileLoader = async (path: string) => {
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      // Use an indirect require so bundlers (webpack 5) don't try to resolve
      // 'fs' for the browser build
      const req = Function('return require')();
      const fs = req('fs');
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      return '';
    }
  }
  return '';
};

export function setFileLoader(loader: FileLoader) {
  readFile = loader;
}