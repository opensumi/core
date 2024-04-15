import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IAIReporter } from '@opensumi/ide-core-common';

import { IAIChatService } from '../../common/index';
import { ChatService } from '../chat/chat.service';
import { TSlashCommandCustomRender } from '../types';

// slash command 自定义渲染组件
export const SlashCustomRender = (props: {
  message: string;
  relationId: string;
  renderContent: TSlashCommandCustomRender;
  startTime: number;
}) => {
  const { message, relationId, renderContent, startTime } = props;

  const aiChatService = useInjectable<ChatService>(IAIChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  React.useEffect(() => {
    aiChatService.setLatestSessionId(relationId);

    aiReporter.end(relationId, {
      message,
      replytime: Date.now() - startTime,
      success: true,
      isStop: false,
    });
  }, [renderContent, relationId]);

  return <div>{renderContent({ userMessage: message })}</div>;
};
