import React, { useCallback, useState } from 'react';

import {
  CommandRegistry,
  CommandService,
  MERGE_CONFLICT_COMMANDS,
  SCM_COMMANDS,
  URI,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { MergeActions } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/components/merge-actions';

import { useMergeConflictModel } from '../merge-conflict/merge-conflict.model';
import { MergeConflictService } from '../merge-conflict/merge-conflict.service';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const { uri } = resource;
  const mergeConflictService = useInjectable<MergeConflictService>(MergeConflictService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const { canNavigate, isVisiable, summary } = useMergeConflictModel(uri);

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
