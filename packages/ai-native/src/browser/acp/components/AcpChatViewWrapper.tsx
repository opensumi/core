/**
 * ACP ChatView Wrapper
 *
 * 为 ACP 模式提供包装层，封装：
 * - ACP 初始化逻辑（等待 Agent 准备）
 * - 等待 sessionModel 准备好
 * - Loading/Error 状态处理
 * - 权限弹窗
 *
 * 非 ACP 模式下直接渲染子组件
 */
import React, { useEffect, useState } from 'react';

import { AINativeConfigService, useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { AIBackSerivcePath, IAIBackService, localize } from '@opensumi/ide-core-common';

import { IChatManagerService } from '../../../common';
import { ChatManagerService } from '../../chat/chat-manager.service';
import { ChatInternalService } from '../../chat/chat.internal.service';
import styles from '../../chat/chat.module.less';

interface AcpChatViewWrapperProps {
  children: React.ReactNode;
  aiChatService: ChatInternalService;
}

export function AcpChatViewWrapper({ children, aiChatService }: AcpChatViewWrapperProps) {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const aiBackService = useInjectable<IAIBackService>(AIBackSerivcePath);
  const chatManagerService = useInjectable<ChatManagerService>(IChatManagerService);

  // ACP 模式初始化状态
  const [initState, setInitState] = useState<{
    initialized: boolean;
    error: string | null;
  }>({
    initialized: false,
    error: null,
  });

  // ACP 模式：等待 sessionModel 准备好
  const [sessionReady, setSessionReady] = useState(false);

  // ACP 模式：只在第一次渲染时触发初始化
  useEffect(() => {
    // 非 ACP 模式不需要延迟初始化
    if (!aiNativeConfigService.capabilities.supportsAgentMode) {
      setInitState({ initialized: true, error: null });
      setSessionReady(true);
      return;
    }

    if (initState.initialized) {
      return;
    }

    const initializeACP = async () => {
      try {
        // 等待 acp-cli-back 的 default agent 初始化完成
        let ready = false;
        let retries = 0;
        const maxRetries = 10; // 最多重试 10 次，每次 1s，总共 10 秒

        while (!ready && retries < maxRetries) {
          const isReady = await aiBackService.ready?.();
          ready = !!isReady;

          if (!ready) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries++;
          }
        }

        if (!ready) {
          throw new Error('ACP backend service is not ready after maximum retries');
        }

        // 先调用 aiChatService.init() 注册 onStorageInit 监听器
        aiChatService.init();
        // 创建新会话
        await aiChatService.createSessionModel();

        // 加载历史会话列表（用于 history 下拉展示）
        await chatManagerService.loadSessionList();

        setInitState({ initialized: true, error: null });
      } catch (error) {
        setInitState({
          initialized: true,
          error: error instanceof Error ? error.message : String(error) || 'ACP 服务初始化失败',
        });
      }
    };

    initializeACP();
  }, []);

  // 等待 sessionModel 准备好
  useEffect(() => {
    if (!aiNativeConfigService.capabilities.supportsAgentMode) {
      setSessionReady(true);
      return;
    }

    if (!initState.initialized) {
      return;
    }

    // 检查 sessionModel 是否已准备好
    if (aiChatService.sessionModel) {
      setSessionReady(true);
      return;
    }

    // 轮询检查 sessionModel，直到就绪
    let interval: number | null = null;
    let pollCount = 0;
    const MAX_POLL_COUNT = 12000; // 1200s at 100ms intervals

    const checkSession = () => {
      pollCount++;
      if (aiChatService.sessionModel) {
        setSessionReady(true);
        if (interval) {
          clearInterval(interval);
        }
        return;
      }
      if (pollCount >= MAX_POLL_COUNT) {
        if (interval) {
          clearInterval(interval);
        }
        setInitState({
          initialized: true,
          error: 'Session initialization timed out',
        });
      }
    };

    interval = window.setInterval(checkSession, 100);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [initState.initialized]);
  if (!aiNativeConfigService.capabilities.supportsAgentMode) {
    return children;
  }

  // 非 ACP 模式或初始化完成且 session 准备好，直接渲染子组件
  if (initState.initialized && !initState.error && sessionReady) {
    return <>{children}</>;
  }

  // 初始化中或等待 session
  if (!initState.initialized || !sessionReady) {
    return (
      <div className={styles.loading_container}>
        <Progress loading={true} />
        <div>{localize('aiNative.chat.acp.initializing.text', 'Initializing ACP service...')}</div>
      </div>
    );
  }

  // 初始化失败
  if (initState.error) {
    return <ACPErrorView error={initState.error} />;
  }

  return null;
}

function ACPErrorView({ error }: { error: string }) {
  return (
    <div className={styles.acp_error_container}>
      <div className={styles.acp_error_icon}>⚠️</div>
      <div className={styles.acp_error_title}>{localize('aiNative.chat.acp.init.failed', 'ACP 服务初始化失败')}</div>
      <div className={styles.acp_error_message}>{error}</div>
      <div className={styles.acp_error_hint}>
        {localize('aiNative.chat.acp.init.hint', '请检查服务端是否已启动，然后关闭面板后重新打开')}
      </div>
    </div>
  );
}
