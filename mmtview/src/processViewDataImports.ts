import {dataImportProcessor} from 'mmt-core';
import {readFile} from './vsAPI';

export async function processViewDataImports(
    rawText: string,
    filePath?: string,
    projectRoot?: string,
    keepDataImports = false,
): Promise<string> {
  if (!rawText || !/\nimport\s*:/m.test(rawText) && !/^import\s*:/m.test(rawText)) {
    return rawText;
  }
  try {
    return await dataImportProcessor.processDataImportsInYaml({
      rawText,
      filePath,
      projectRoot,
      keepDataImports,
      fileLoader: readFile,
    });
  } catch {
    return rawText;
  }
}
