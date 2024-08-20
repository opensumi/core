import debounce from 'lodash/debounce';
import { useEffect, useMemo, useState } from 'react';

import { formatLocalize, useInjectable } from '@opensumi/ide-core-browser';
import { DisposableStore, URI } from '@opensumi/ide-utils';

import { useEditorDocumentModel } from '../hooks/useEditor';

import { MergeConflictService } from './merge-conflict.service';

export function useMergeConflictModel(uri: URI) {
  const editorModel = useEditorDocumentModel(uri);

  /**
   * 如果是原来就有冲突的文件，当冲突没了之后，仍然显示冲突
   */
  const [isInitialVisiable, setIsInitialVisiable] = useState(false);
  const [conflictsCount, setConflictsCount] = useState(0);

  const mergeConflictService = useInjectable<MergeConflictService>(MergeConflictService);

  const summary = useMemo(
    () => formatLocalize('merge-conflicts.merge.conflict.remain', conflictsCount),
    [conflictsCount],
  );

  useEffect(() => {
    const disposables = new DisposableStore();

    if (editorModel) {
      const run = () => {
        const n = mergeConflictService.scanDocument(editorModel.getMonacoModel());
        setConflictsCount(n);
        if (n > 0) {
          setIsInitialVisiable(true);
        }
      };

      const debounceRun = debounce(run, 150);

      disposables.add(
        editorModel.getMonacoModel().onDidChangeContent(() => {
          debounceRun();
        }),
      );

      run();
      return () => {
        disposables.dispose();
        mergeConflictService.clear();
        setIsInitialVisiable(false);
        setConflictsCount(0);
      };
    }
  }, [editorModel]);

  return {
    isVisiable: isInitialVisiable,
    summary,
    canNavigate: conflictsCount > 0,
  };
}
