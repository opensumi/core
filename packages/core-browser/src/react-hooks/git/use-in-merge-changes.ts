import { useEffect, useState } from 'react';

import { IContextKeyService } from '../../context-key';
import { useInjectable } from '../injectable-hooks';

const contextKey = 'git.mergeChangesObj';

export const gitMergeChangesSet = new Set([contextKey]);

export function useInMergeChanges(uriStr: string) {
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);

  const [inMergeChanges, setInMergeChanges] = useState(false);

  useEffect(() => {
    function run() {
      const mergeChanges = contextKeyService.getValue<Record<string, boolean>>(contextKey) || {};
      setInMergeChanges(mergeChanges[uriStr] || false);
    }
    run();

    const disposed = contextKeyService.onDidChangeContext(({ payload }) => {
      if (payload.affectsSome(gitMergeChangesSet)) {
        run();
      }
    });
    return () => disposed.dispose();
  }, [uriStr]);

  return inMergeChanges;
}
