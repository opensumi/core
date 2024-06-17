import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useState } from 'react';

import {
  CommandRegistry,
  CommandService,
  DisposableStore,
  MERGE_CONFLICT_COMMANDS,
  SCM_COMMANDS,
  URI,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { MergeActions } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/components/merge-actions';

import { useEditorDocumentModelRef } from '../hooks/useEditor';
import { MergeConflictService } from '../merge-conflict/merge-conflict.service';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const { uri } = resource;
  const editorModel = useEditorDocumentModelRef(uri);
  const mergeConflictService = useInjectable<MergeConflictService>(MergeConflictService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const [isVisiable, setIsVisiable] = useState(false);
  const [summary, setSummary] = useState('');
  const [canNavigate, setCanNavigate] = useState(false);

  useEffect(() => {
    const disposables = new DisposableStore();

    if (editorModel) {
      const { instance } = editorModel;
      const run = () => {
        const n = mergeConflictService.scanDocument(instance.getMonacoModel());
        setSummary(mergeConflictService.summary);
        if (n > 0) {
          setIsVisiable(true);
          setCanNavigate(true);
        } else {
          setCanNavigate(false);
        }
      };

      const debounceRun = debounce(run, 150);

      disposables.add(
        editorModel.instance.getMonacoModel().onDidChangeContent(() => {
          debounceRun();
        }),
      );

      run();
      return () => {
        disposables.dispose();
      };
    }
  }, [editorModel]);

  const [isAIResolving, setIsAIResolving] = useState(false);
  const handlePrev = useCallback(() => {
    mergeConflictService.navigatePrevious();
  }, []);

  const handleNext = useCallback(() => {
    mergeConflictService.navigateNext();
  }, []);
  const handleAIResolve = useCallback(async () => {
    setIsAIResolving(true);
    if (isAIResolving) {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT_STOP.id, uri);
    } else {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT.id, uri);
    }
    setIsAIResolving(false);
  }, [uri, isAIResolving]);

  if (!isVisiable) {
    return null;
  }

  return (
    <MergeActions
      uri={uri}
      editorType='text'
      summary={summary}
      canNavigate={canNavigate}
      handleNext={handleNext}
      handlePrev={handlePrev}
      isAIResolving={isAIResolving}
      onAIResolve={handleAIResolve}
      onReset={() => {
        commandService.executeCommand(MERGE_CONFLICT_COMMANDS.ALL_RESET.id, uri);
      }}
      onSwitchEditor={() => {
        [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
          if (commandRegistry.getCommand(command) && commandRegistry.isEnabled(command)) {
            commandService.executeCommand(command, uri);
          }
        });
      }}
    />
  );
};
