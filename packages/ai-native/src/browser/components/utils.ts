import { ITextMessageProps } from 'react-chat-elements';

import { CODICON_OWNER, getExternalIcon } from '@opensumi/ide-core-browser';
import { ChatMessageRole } from '@opensumi/ide-core-common/lib/types/ai-native';

import { IChatReplyFollowup, ISampleQuestions } from '../../common/index';

export interface MessageData extends Pick<ITextMessageProps, 'id' | 'position' | 'className' | 'title'> {
  role: ChatMessageRole;
  relationId: string;
  className?: string;
  text: string | React.ReactNode;
}

const ME_NAME = '';

type AIMessageData = Omit<MessageData, 'role' | 'position' | 'title'>;
type UserMessageData = Omit<MessageData, 'role' | 'position' | 'title'>;

const createMessage = (message: MessageData) => ({
  ...message,
  type: 'text',
  className: `${message.position === 'left' ? 'rce-ai-msg' : 'rce-user-msg'} ${
    message.className ? message.className : ''
  }`,
});

export const createMessageByUser = (message: UserMessageData, className?: string) =>
  createMessage({ ...message, position: 'right', title: ME_NAME, className, role: ChatMessageRole.User });

export const createMessageByAI = (message: AIMessageData, className?: string) =>
  createMessage({ ...message, position: 'left', title: '', className, role: ChatMessageRole.Assistant });

export const extractIcon = (question: ISampleQuestions): ISampleQuestions => {
  let { title } = question;
  const { message, tooltip } = question;

  let icon = question.icon || '';

  if (!title) {
    return {
      icon,
      title: message,
      message,
      tooltip,
    };
  }

  const iconMatched = title.match(/^\$\(([a-z.]+\/)?([a-z0-9-]+)(~[a-z]+)?\)/i);
  if (iconMatched) {
    const [matchedStr, owner, name, modifier] = iconMatched;
    const iconOwner = owner ? owner.slice(0, -1) : CODICON_OWNER;
    icon = getExternalIcon(name, iconOwner);
    if (modifier) {
      icon += ` ${modifier.slice(1)}`;
    }
    title = title.slice(matchedStr.length);
  }

  return {
    icon,
    title,
    message,
    tooltip,
  };
};
