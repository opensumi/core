/**
 * ACP ChatView Wrapper
 *
 * 为 ACP 模式提供包装层，封装：
 * - ACP 初始化逻辑（等待 Agent 准备）
 * - 等待历史会话元数据准备好
 * - Loading/Error 状态处理
 * - 权限弹窗
 *
 * 非 ACP 模式下直接渲染子组件
 */
import React, { useEffect, useRef, useState } from 'react';

import { AINativeConfigService, useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { AIBackSerivcePath, IAIBackService, localize } from '@opensumi/ide-core-common';

import { ChatProxyServiceToken, IChatManagerService } from '../../../common';
import { AcpChatManagerService } from '../../chat/chat-manager.service.acp';
import { AcpChatProxyService } from '../../chat/chat-proxy.service.acp';
import { ChatInternalService } from '../../chat/chat.internal.service';
import styles from '../../chat/chat.module.less';

interface AcpChatViewWrapperProps {
  children: React.ReactNode;
  aiChatService: ChatInternalService;
}

type AcpBootstrapChatService = ChatInternalService & {
  ensureBootstrapSessionModel?: () => Promise<unknown>;
};

export function AcpChatViewWrapper({ children, aiChatService }: AcpChatViewWrapperProps) {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const aiBackService = useInjectable<IAIBackService>(AIBackSerivcePath);
  const chatManagerService = useInjectable<AcpChatManagerService>(IChatManagerService);
  const chatProxyService = useInjectable<AcpChatProxyService>(ChatProxyServiceToken);

  // ACP 模式初始化状态
  const [initState, setInitState] = useState<{
    initialized: boolean;
  }>({
    initialized: false,
  });

  // 用于取消当前初始化的 cancelled flag
  const cancelledRef = useRef(false);

  // ACP 模式：组件 mount 时触发初始化
  useEffect(() => {
    // 非 ACP 模式不需要延迟初始化
    if (!aiNativeConfigService.capabilities.supportsAgentMode) {
      setInitState({ initialized: true });
      return;
    }

    cancelledRef.current = false;
    const cancelled = () => cancelledRef.current;

    const initializeACP = async () => {
      try {
        // 等待 acp-cli-back 的 default agent 初始化完成
        let ready = false;
        let retries = 0;
        const maxRetries = 10; // 最多重试 10 次，每次 1s，总共 10 秒

        while (!ready && retries < maxRetries) {
          if (cancelled()) {
            return;
          }
          const isReady = await aiBackService.ready?.();
          ready = !!isReady;

          if (!ready) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries++;
          }
        }

        if (cancelled()) {
          return;
        }

        if (!ready) {
          throw new Error('ACP backend service is not ready after maximum retries');
        }

        // 先调用 aiChatService.init() 注册 onStorageInit 监听器
        aiChatService.init();

        // 加载历史会话列表（用于 history 下拉展示）
        await chatManagerService.loadSessionList();

        if (cancelled()) {
          return;
        }

        try {
          await (aiChatService as AcpBootstrapChatService).ensureBootstrapSessionModel?.();
        } catch {
          // Bootstrap is a UX warm-up only. The first real send still creates a session lazily.
        }

        if (cancelled()) {
          return;
        }

        setInitState({ initialized: true });
      } catch (error) {
        if (cancelled()) {
          return;
        }
        // Fallback to default agent when ACP is unavailable
        chatManagerService.fallbackToLocal();
        chatProxyService.registerFallbackAgent();
        if (!aiChatService.sessionModel) {
          await aiChatService.createSessionModel();
        }
        setInitState({ initialized: true });
      }
    };

    initializeACP();

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  if (!aiNativeConfigService.capabilities.supportsAgentMode) {
    return children;
  }

  // ACP 模式初始化完成后渲染子组件；真正的 session 会在首次发送时创建。
  if (initState.initialized) {
    return <>{children}</>;
  }

  // 初始化中
  return (
    <div className={styles.loading_container}>
      <Progress loading={true} />
      <div>{localize('aiNative.chat.acp.initializing.text', 'Initializing ACP service...')}</div>
    </div>
  );
}
