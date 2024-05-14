import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { IAIReporter } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../common/index';
import { ChatInternalService } from '../chat/chat.internal.service';
import { TSlashCommandCustomRender } from '../types';

// slash command 自定义渲染组件
export const SlashCustomRender = (props: {
  userMessage: string;
  requestId: string;
  relationId: string;
  renderContent: TSlashCommandCustomRender;
  startTime: number;
}) => {
  const { userMessage, relationId, requestId, renderContent, startTime } = props;

  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  React.useEffect(() => {
    aiChatService.setLatestRequestId(requestId);

    aiReporter.end(relationId, {
      message: userMessage,
      replytime: Date.now() - startTime,
      success: true,
      isStop: false,
    });
  }, [renderContent, requestId, relationId]);

  return <div>{renderContent({ userMessage })}</div>;
};
