import React, { Fragment, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { Button } from '@opensumi/ide-components/lib/button';
import { BasicRecycleTree, IBasicRecycleTreeHandle, IBasicTreeData } from '@opensumi/ide-components/lib/recycle-tree';
import {
  BasicCompositeTreeNode,
  BasicTreeNode,
} from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { Tooltip } from '@opensumi/ide-components/lib/tooltip';
import {
  CommandService,
  DisposableCollection,
  EDITOR_COMMANDS,
  IContextKeyService,
  LabelService,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { getIcon, Icon } from '@opensumi/ide-core-browser/lib/components';
import { FileType, URI } from '@opensumi/ide-core-common';
import { IAIReporter } from '@opensumi/ide-core-common/lib/ai-native/reporter';
import { IIconService } from '@opensumi/ide-theme';
import { IMarkdownString, MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import { IChatAgentService, IChatContent, IChatResponseProgressFileTreeData } from '../../common';
import { AiChatService } from '../ai-chat.service';
import { ChatRequestModel } from '../chat-model';
import { EMsgStreamStatus, MsgStreamManager } from '../model/msg-stream-manager';
import { IChatAgentViewService } from '../types';

import styles from './components.module.less';
import { Loading } from './Loading';
import { Markdown } from './Markdown';
import { Thinking, ThinkingResult } from './Thinking';

interface IChatReplyProps {
  relationId: string;
  request: ChatRequestModel;
  startTime?: number;
  onRegenerate?: () => void;
}

const TreeRenderer = (props: { treeData: IChatResponseProgressFileTreeData }) => {
  const labelService = useInjectable<LabelService>(LabelService);
  const commandService = useInjectable<CommandService>(CommandService);

  const getIconClassName = (uri: URI, isDirectory: boolean, expanded: boolean) => {
    // getIcon 没有处理 isOpenedDirectory
    let iconClassName = labelService.getIcon(uri, { isDirectory });
    if (isDirectory && expanded) {
      iconClassName += ' expanded';
    }
    return iconClassName;
  };

  const recycleTreeData = useMemo(() => {
    const transform = (item: IChatResponseProgressFileTreeData): IBasicTreeData => {
      const isDirectory = typeof item.type === 'number' ? item.type === FileType.Directory : !!item.children;
      const uri = new URI(item.uri);
      return {
        label: item.label,
        iconClassName: getIconClassName(uri, isDirectory, isDirectory),
        expandable: true,
        expanded: true,
        children: isDirectory ? (item.children || []).map(transform) : null,
        uri,
      };
    };
    return (props.treeData.children || []).map(transform);
  }, [props.treeData]);

  const [height, setHeight] = useState(22);

  const fileHandle = useRef<IBasicRecycleTreeHandle | null>(null);

  const onReady = (handle: IBasicRecycleTreeHandle) => {
    fileHandle.current = handle;
    const calcHeight = () => {
      let size = handle.getModel().root.branchSize;
      if (size < 1) {
        size = 1;
      } else if (size > 20) {
        size = 20;
      }
      setHeight(size * 22);
    };
    calcHeight();
    handle.onDidUpdate(calcHeight);
  };

  if (!recycleTreeData.length) {
    return null;
  }

  return (
    <div className={styles.tree_container}>
      <BasicRecycleTree
        height={height}
        treeData={recycleTreeData}
        onContextMenu={(e) => e.preventDefault()}
        // onTwistierClick={e => e.stopPropagation()}
        onClick={(e, item: BasicCompositeTreeNode | BasicTreeNode) => {
          if (!fileHandle.current || !item) {
            return;
          }
          if (!BasicCompositeTreeNode.is(item)) {
            commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, item.raw.uri, {
              disableNavigate: true,
              preview: true,
            });
          } else {
            item.raw.iconClassName = getIconClassName(item.raw.uri, true, item.expanded);
          }
        }}
        onReady={onReady}
        treeName={props.treeData.label}
        leaveBottomBlank={false}
        baseIndent={0}
      />
    </div>
  );
};

const ComponentRender = (props: { component: string; value?: unknown }) => {
  const chatAgentViewService = useInjectable<IChatAgentViewService>(IChatAgentViewService);
  const [node, setNode] = useState<React.JSX.Element | null>(null);

  useEffect(() => {
    const config = chatAgentViewService.getChatComponent(props.component);
    if (config) {
      const { component: Component, initialProps } = config;
      setNode(<Component {...initialProps} value={props.value} />);
      return;
    }
    setNode(
      <div>
        <Loading />
        <span style={{ marginLeft: 4 }}>正在加载组件</span>
      </div>,
    );
    const deferred = chatAgentViewService.getChatComponentDeferred(props.component)!;
    deferred.promise.then(({ component: Component, initialProps }) => {
      setNode(<Component {...initialProps} value={props.value} />);
    });
  }, []);

  return node;
};

export const ChatReply = (props: IChatReplyProps) => {
  const { relationId, request, startTime = 0, onRegenerate } = props;

  const [, update] = useReducer((num) => (num + 1) % 1_000_000, 0);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
  const iconService = useInjectable<IIconService>(IIconService);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);

  const isLastReply = msgStreamManager.currentSessionId === relationId;

  useEffect(() => {
    const disposableCollection = new DisposableCollection();

    disposableCollection.push(
      request.response.onDidChange(() => {
        if (request.response.isComplete) {
          aiReporter.end(relationId, {
            message: request.response.responseText,
            replytime: Date.now() - startTime,
            success: true,
            isStop: false,
          });
          msgStreamManager.sendDoneStatue();
        } else {
          msgStreamManager.sendThinkingStatue();
        }
        update();
      }),
    );

    disposableCollection.push(
      msgStreamManager.onMsgStatus(() => {
        if (msgStreamManager.currentSessionId !== relationId) {
          update();
        }
      }),
    );

    return () => disposableCollection.dispose();
  }, [relationId]);

  const handleRegenerate = useCallback(() => {
    request.response.reset();
    onRegenerate?.();
  }, [onRegenerate]);

  const onStop = () => {
    aiReporter.end(relationId, {
      message: request.response.responseText,
      replytime: Date.now() - startTime,
      success: false,
      isStop: true,
    });
    aiChatService.cancelRequest();
  };

  const renderMarkdown = (markdown: IMarkdownString) => (
    // TODO: Markdown 属性限制
    <Markdown markdown={markdown} fillInIncompleteTokens relationId={relationId} />
  );
  const renderTreeData = (treeData: IChatResponseProgressFileTreeData) => <TreeRenderer treeData={treeData} />;

  const renderPlaceholder = (markdown: IMarkdownString) => (
    <div className={styles.placeholder}>
      <Icon iconClass={iconService.fromString('$(codicon/sync~spin)')} />
      <div className={styles.placeholder_content}>{renderMarkdown(markdown)}</div>
    </div>
  );

  const renderComponent = (componentId: string, value: unknown) => (
    <ComponentRender component={componentId} value={value} />
  );

  const contentNode = React.useMemo(
    () =>
      request.response.responseContents.map((item, index) => {
        let node: ReactNode;
        if (item.kind === 'asyncContent') {
          node = renderPlaceholder(new MarkdownString(item.content));
        } else if (item.kind === 'treeData') {
          node = renderTreeData(item.treeData);
        } else if (item.kind === 'component') {
          node = renderComponent(item.component, item.value);
        } else {
          node = renderMarkdown(item.content);
        }
        return <Fragment key={`${item.kind}-${index}`}>{node}</Fragment>;
      }),
    [request.response.responseContents],
  );

  const followupNode = React.useMemo(() => {
    if (!request.response.followups) {
      return null;
    }
    return request.response.followups.map((item, index) => {
      let node: React.ReactNode = null;
      if (item.kind === 'reply') {
        const a = (
          <a onClick={() => aiChatService.launchChatMessage(chatAgentService.parseMessage(item.message))}>
            {item.title || item.message}
          </a>
        );
        node = item.tooltip ? <Tooltip title={item.tooltip}>{a}</Tooltip> : a;
      } else {
        if (item.when && !contextKeyService.match(item.when)) {
          node = null;
        }
        node = <Button type='default'>{item.title}</Button>;
      }
      return node && <Fragment key={index}>{node}</Fragment>;
    });
  }, [request.response.followups]);

  if (!request.response.isComplete && isLastReply) {
    return (
      <Thinking status={msgStreamManager.status} message={request.response.responseText} onStop={onStop} hasAgent>
        {contentNode}
      </Thinking>
    );
  }

  return (
    <ThinkingResult
      status={EMsgStreamStatus.DONE}
      hasMessage={request.response.responseParts.length > 0 || !!request.response.errorDetails?.message}
      onRegenerate={handleRegenerate}
      sessionId={relationId}
    >
      <div className={styles.ai_chat_response_container}>
        {request.response.errorDetails?.message ? (
          <div className={styles.error}>
            <Icon className={getIcon('close-circle')} />
            <span>{request.response.errorDetails.message}</span>
          </div>
        ) : (
          <>
            {contentNode}
            {followupNode?.length !== 0 && <div className={styles.followups}>{followupNode}</div>}
          </>
        )}
      </div>
    </ThinkingResult>
  );
};

interface IChatNotifyProps {
  relationId: string;
  chunk: IChatContent;
}
export const ChatNotify = (props: IChatNotifyProps) => (
  <ThinkingResult status={EMsgStreamStatus.DONE} hasMessage sessionId={props.relationId} regenerateDisabled>
    <Markdown markdown={props.chunk.content} relationId={props.relationId} />
  </ThinkingResult>
);
