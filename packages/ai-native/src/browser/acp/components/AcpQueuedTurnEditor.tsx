import * as React from 'react';

import { AppConfig, useInjectable } from '@opensumi/ide-core-browser';

import { AcpTurnEditor } from './AcpTurnEditor';

import type { QueuedTurnEditorProps } from '../../chat/chat.input.registry';

export const AcpQueuedTurnEditor = ({
  turn,
  onSave,
  onCancel,
  onImmediateSend,
  onReady,
  disabled,
  immediateSendDisabled,
}: QueuedTurnEditorProps) => {
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const [agentId, setAgentId] = React.useState(turn.agentId || '');
  const [command, setCommand] = React.useState(turn.command || '');
  const [theme, setTheme] = React.useState<string | null>(null);

  return (
    <AcpTurnEditor
      variant='queued'
      initialDraft={turn}
      agentId={agentId}
      setAgentId={setAgentId}
      command={command}
      setCommand={setCommand}
      theme={theme}
      setTheme={setTheme}
      agentCwd={appConfig.workspaceDir}
      onSend={(message, images, nextAgentId, nextCommand) =>
        onSave({ message, images, agentId: nextAgentId, command: nextCommand })
      }
      onCancelEdit={onCancel}
      onImmediateSend={onImmediateSend}
      onInputHandleReady={onReady}
      disabled={disabled}
      immediateSendDisabled={immediateSendDisabled}
    />
  );
};
