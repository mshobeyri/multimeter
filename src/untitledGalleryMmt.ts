import * as vscode from 'vscode';

import {getTempFilesController} from './tempFiles/tempFilesController';

/** Open an empty temp .mmt so the gallery (no-type) UI is shown. */
export async function openUntitledGalleryMmt(
    options?: {onlyIfMissing?: boolean}): Promise<void> {
  await getTempFilesController().createAndOpen({
    content: '',
    suggestedName: 'untitled.mmt',
    onlyIfMissing: options?.onlyIfMissing,
  });
}

/** Open a temp .mmt custom editor prefilled with content. */
export async function openUntitledMmtWithContent(
    content: string,
    options?: {
      suggestedName?: string;
      viewColumn?: vscode.ViewColumn;
    }): Promise<vscode.Uri> {
  return getTempFilesController().createAndOpen({
    content,
    suggestedName: options?.suggestedName || 'untitled.mmt',
    viewColumn: options?.viewColumn,
  });
}
