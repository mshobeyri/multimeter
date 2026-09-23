import { useCallback, useContext, useState } from 'react';
import { FileContext } from './fileContext';

/**
 * Swipe page state scoped to the open file.
 * When the file changes, page snaps back to defaultPage immediately so inactive
 * swipe pages unmount before their effects run.
 */
export function usePanelPage<T extends string>(
  defaultPage: T,
): [T, (page: T) => void] {
  const { mmtFilePath } = useContext(FileContext);
  const fileKey = mmtFilePath ?? '';
  const [state, setState] = useState({ fileKey, page: defaultPage });

  if (state.fileKey !== fileKey) {
    setState({ fileKey, page: defaultPage });
  }

  const setPage = useCallback((page: T) => {
    setState({ fileKey, page });
  }, [fileKey]);

  const page = state.fileKey === fileKey ? state.page : defaultPage;
  return [page, setPage];
}
