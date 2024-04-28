import { useEffect, useState } from 'react';

import { IContextKeyService, useInjectable } from '@opensumi/ide-core-browser';

export const gitMergeChangesSet = new Set(['git.mergeChanges']);

export function useInMergeChanges(uriStr: string) {
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);

  const [inMergeChanges, setInMergeChanges] = useState(false);

  useEffect(() => {
    function run() {
      const mergeChanges = contextKeyService.getValue<Record<string, boolean>>('git.mergeChangesObj') || {};
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
