import React from 'react';

import { AcpTurnEditor } from './AcpTurnEditor';

import type { AcpTurnEditorHandle, IChatMentionInputProps } from './AcpTurnEditor';

export type {
  AcpTurnEditorHandle,
  AcpTurnEditorProps,
  AcpTurnEditorVariant,
  IChatMentionInputProps,
} from './AcpTurnEditor';

export type AcpChatMentionInputHandle = AcpTurnEditorHandle;

export interface AcpChatMentionInputLegacyHandle {
  setInputValue(value: string): void;
}

export interface AcpChatMentionInputComponent
  extends React.ForwardRefExoticComponent<IChatMentionInputProps & React.RefAttributes<AcpTurnEditorHandle>> {
  (props: IChatMentionInputProps & React.RefAttributes<AcpChatMentionInputLegacyHandle>): React.ReactElement | null;
}

const AcpChatMentionInputImpl = React.forwardRef<AcpTurnEditorHandle, IChatMentionInputProps>((props, ref) => (
  <AcpTurnEditor {...props} ref={ref} variant='main' />
));

export const AcpChatMentionInput = AcpChatMentionInputImpl as AcpChatMentionInputComponent;
