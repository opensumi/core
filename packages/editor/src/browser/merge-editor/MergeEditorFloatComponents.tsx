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
import { formatLocalize } from '@opensumi/ide-core-common';
import { MergeConflictCommands } from '@opensumi/ide-core-common/lib/commands/git';
import { MergeActions } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/components/merge-actions';

import { useEditorDocumentModelRef } from '../hooks/useEditor';
import { DocumentMergeConflict, MergeConflictParser } from '../merge-conflict';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const { uri } = resource;
  const editorModel = useEditorDocumentModelRef(uri);
  const mergeConflictParser: MergeConflictParser = useInjectable(MergeConflictParser);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const [isVisiable, setIsVisiable] = useState(false);
  const [conflicts, setConflicts] = useState<DocumentMergeConflict[]>([]);

  useEffect(() => {
    const disposables = new DisposableStore();

    if (editorModel) {
      const { instance } = editorModel;
      const run = () => {
        const conflicts = mergeConflictParser.scanDocument(instance.getMonacoModel());
        if (conflicts.length > 0) {
          setIsVisiable(true);
          setConflicts(conflicts);
        } else {
          setIsVisiable(false);
          setConflicts([]);
        }
      };

      disposables.add(
        editorModel.instance.getMonacoModel().onDidChangeContent(() => {
          run();
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
    commandService.tryExecuteCommand(MergeConflictCommands.Previous).then(() => {
      // TODO: 编辑器向上滚动一行
    });
  }, []);

  const handleNext = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Next).then(() => {
      // TODO: 编辑器向上滚动一行
    });
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

  const summary = formatLocalize('merge-conflicts.merge.conflict.remain', conflicts.length);
  return (
    <MergeActions
      uri={uri}
      editorType='text'
      summary={summary}
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
