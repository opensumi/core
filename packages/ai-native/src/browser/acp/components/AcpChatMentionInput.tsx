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

export const AcpChatMentionInput = React.forwardRef<AcpTurnEditorHandle, IChatMentionInputProps>((props, ref) => (
  <AcpTurnEditor {...props} ref={ref} variant='main' />
));
