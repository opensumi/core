import * as React from 'react';

import {
  AcpChatMentionInput,
  AcpTurnEditorHandle,
  IChatMentionInputProps,
} from '../../lib/browser/acp/components/AcpChatMentionInput';

const props: IChatMentionInputProps = {
  onSend: () => undefined,
  setTheme: () => undefined,
  agentId: '',
  setAgentId: () => undefined,
  command: '',
  setCommand: () => undefined,
};

const legacyRef: React.RefObject<{ setInputValue(value: string): void }> = React.createRef();
const fullRef: React.RefObject<AcpTurnEditorHandle> = React.createRef();

export const legacyRefCompatibilityElement = <AcpChatMentionInput {...props} ref={legacyRef} />;
export const fullRefCompatibilityElement = <AcpChatMentionInput {...props} ref={fullRef} />;
