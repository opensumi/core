import * as React from 'react';

import { useInjectable, useUpdateOnEvent } from '@opensumi/ide-core-browser';
import { Icon, Tooltip } from '@opensumi/ide-core-browser/lib/components';
import { withPrevented } from '@opensumi/ide-core-browser/lib/dom/event';
import {
  ActionSourceEnum,
  ActionTypeEnum,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  ChatServiceToken,
  localize,
} from '@opensumi/ide-core-common';
import { isMarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import 'react-chat-elements/dist/main.css';
import { IChatAgentService, ISampleQuestions } from '../../common';
import { ChatService } from '../chat/chat.api.service';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { ChatRenderRegistry } from '../chat/chat.render.registry';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { ChatThinking } from '../components/ChatThinking';
import { extractIcon } from '../components/utils';

import styles from './components.module.less';

export const WelcomeMessage = () => {
  const aiChatService = useInjectable<ChatService>(ChatServiceToken);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);

  const [sampleQuestions, setSampleQuestions] = React.useState<ISampleQuestions[]>([]);

  useUpdateOnEvent(chatFeatureRegistry.onDidWelcomeMessageChange);

  const welcomeSampleQuestions = React.useMemo(() => {
    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return [];
    }

    const { sampleQuestions = [] } = chatFeatureRegistry.chatWelcomeMessageModel;
    return sampleQuestions.map(extractIcon);
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.sampleQuestions]);

  const welcomeMessage = React.useMemo(() => {
    if (!chatFeatureRegistry.chatWelcomeMessageModel) {
      return '';
    }

    const { content } = chatFeatureRegistry.chatWelcomeMessageModel;
    return content;
  }, [chatFeatureRegistry.chatWelcomeMessageModel?.content]);

  React.useEffect(() => {
    const disposer = chatAgentService.onDidChangeAgents(async () => {
      const sampleQuestions = await chatAgentService.getAllSampleQuestions();
      const lists = sampleQuestions.map(extractIcon);
      setSampleQuestions(lists);
    });
    return () => disposer.dispose();
  }, []);

  if (!welcomeMessage) {
    return <ChatThinking thinkingText={localize('aiNative.chat.welcome.loading.text')} />;
  }

  const allSampleQuestions = React.useMemo(
    () => welcomeSampleQuestions.concat(sampleQuestions),
    [welcomeSampleQuestions, sampleQuestions],
  );

  const welcomeRender = React.useMemo(() => {
    if (chatRenderRegistry.chatWelcomeRender) {
      const Render = chatRenderRegistry.chatWelcomeRender;
      return <Render message={welcomeMessage} sampleQuestions={allSampleQuestions} />;
    }

    return (
      <div className={styles.chat_welcome_head}>
        <div className={styles.chat_container_des}>
          {isMarkdownString(welcomeMessage) ? <ChatMarkdown markdown={welcomeMessage} /> : welcomeMessage}
        </div>
        <div className={styles.chat_container_content}>
          {allSampleQuestions.map((data: any, index) => {
            const node = (
              <a
                className={styles.link_item}
                onClick={withPrevented(() => {
                  aiChatService.sendMessage({
                    ...chatAgentService.parseMessage(data.message),
                    reportExtra: {
                      actionType: ActionTypeEnum.Welcome,
                      actionSource: ActionSourceEnum.Chat,
                    },
                  });
                })}
              >
                {data.icon ? <Icon className={data.icon} style={{ color: 'inherit', marginRight: '4px' }} /> : ''}
                <span>{data.title}</span>
              </a>
            );
            return data.tooltip ? (
              <Tooltip title={data.tooltip} key={index}>
                {node}
              </Tooltip>
            ) : (
              <React.Fragment key={index}>{node}</React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }, [chatRenderRegistry.chatWelcomeRender, welcomeMessage, allSampleQuestions]);

  return welcomeRender as React.JSX.Element;
};
