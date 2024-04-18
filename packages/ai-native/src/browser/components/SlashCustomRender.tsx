import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IAIReporter } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../common/index';
import { ChatInternalService } from '../chat/chat.internal.service';
import { TSlashCommandCustomRender } from '../types';

// slash command 自定义渲染组件
export const SlashCustomRender = (props: {
  userMessage: string;
  relationId: string;
  renderContent: TSlashCommandCustomRender;
  startTime: number;
}) => {
  const { userMessage, relationId, renderContent, startTime } = props;

  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  React.useEffect(() => {
    aiChatService.setLatestSessionId(relationId);

    aiReporter.end(relationId, {
      message: userMessage,
      replytime: Date.now() - startTime,
      success: true,
      isStop: false,
    });
  }, [renderContent, relationId]);

  return <div>{renderContent({ userMessage })}</div>;
};
