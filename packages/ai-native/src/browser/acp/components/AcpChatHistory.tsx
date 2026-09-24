import cls from 'classnames';
import React, { FC, memo, useCallback, useEffect, useRef, useState } from 'react';

import { Icon, Input, Loading, Popover, PopoverPosition, PopoverTriggerType, getIcon } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-browser';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ThreadStatus } from '@opensumi/ide-core-common';

import { AI_CHAT_NEW_CHAT } from '../../chat/acp-new-draft.commands';
import { useCommandKeybindingLabel } from '../../chat/use-command-keybinding-label';
import styles from '../../components/acp/chat-history.module.less';

const threadStatusIcon: Record<ThreadStatus, string> = {
  idle: 'disconnect',
  working: 'loading',
  stopping: 'debug-pause',
  awaiting_prompt: 'disconnect',
  auth_required: 'disconnect',
  errored: 'error',
  disconnected: 'disconnect',
};

function renderThreadStatusIcon(status: ThreadStatus | undefined, loading: boolean, testId: string) {
  const effectiveStatus: ThreadStatus = status ?? (loading ? 'working' : 'idle');
  const iconName = threadStatusIcon[effectiveStatus] || threadStatusIcon.idle;
  return (
    <Icon
      data-testid={testId}
      iconClass={getIcon(iconName)}
      animate={effectiveStatus === 'working' ? 'spin' : undefined}
      style={{ fontSize: 14, marginRight: 4, flexShrink: 0, opacity: 0.6 }}
    />
  );
}

export interface IChatHistoryItem {
  id: string;
  title: string;
  createdAt: number;
  loading: boolean;
  threadStatus?: ThreadStatus;
  hasPendingPermission?: boolean;
}

export interface IChatHistoryProps {
  title: string;
  historyList: IChatHistoryItem[];
  currentId?: string;
  className?: string;
  variant?: 'popover' | 'inline';
  historyLoading?: boolean;
  disabled?: boolean;
  historyCollapsed?: boolean;
  pendingPermissionBadge?: number;
  onNewChat: () => void;
  onOpenMCPConfig?: () => void;
  onToggleHistoryCollapsed?: () => void;
  onHistoryItemSelect: (item: IChatHistoryItem) => void;
  onHistoryItemDelete?: (item: IChatHistoryItem) => void;
  onHistoryItemChange: (item: IChatHistoryItem, title: string) => void;
  onHistoryPopoverVisibleChange?: (visible: boolean) => void;
}

// 最大历史记录数
const MAX_HISTORY_LIST = 100;

/**
 * ACP 专属的 ChatHistory 组件
 * 与原版区别：移除了删除按钮（ACP 模式下由服务端管理会话生命周期）
 */
const AcpChatHistory: FC<IChatHistoryProps> = memo(
  ({
    title,
    historyList,
    currentId,
    onNewChat,
    onOpenMCPConfig,
    onHistoryItemSelect,
    onHistoryItemChange,
    onHistoryPopoverVisibleChange,
    historyLoading,
    disabled,
    historyCollapsed,
    className,
    variant = 'popover',
    pendingPermissionBadge,
    onToggleHistoryCollapsed,
  }) => {
    const [historyTitleEditable, setHistoryTitleEditable] = useState<{
      [key: string]: boolean;
    } | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const inputRef = useRef<any>(null);
    const newChatKeybinding = useCommandKeybindingLabel(AI_CHAT_NEW_CHAT.id);
    const newChatLabel = localize('aiNative.operate.newChat.title', 'New Chat');
    const newChatTitle = `${newChatLabel}${newChatKeybinding ? ` (${newChatKeybinding})` : ''}`;

    // 处理搜索输入变化
    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(event.target.value);
    }, []);

    // 处理历史记录项选择
    const handleHistoryItemSelect = useCallback(
      (item: IChatHistoryItem) => {
        if (disabled) {
          return;
        }
        onHistoryItemSelect(item);
        setSearchValue('');
      },
      [onHistoryItemSelect, disabled],
    );

    // 处理标题编辑
    const handleTitleEdit = useCallback((item: IChatHistoryItem) => {
      setHistoryTitleEditable({
        [item.id]: true,
      });
    }, []);

    // 处理标题编辑完成
    const handleTitleEditComplete = useCallback(
      (item: IChatHistoryItem, newTitle: string) => {
        setHistoryTitleEditable({
          [item.id]: false,
        });
        onHistoryItemChange(item, newTitle);
      },
      [onHistoryItemChange],
    );

    // 处理标题编辑取消
    const handleTitleEditCancel = useCallback((item: IChatHistoryItem) => {
      setHistoryTitleEditable({
        [item.id]: false,
      });
    }, []);

    // 处理新建聊天
    const handleNewChat = useCallback(() => {
      if (disabled) {
        return;
      }
      onNewChat();
    }, [onNewChat, disabled]);

    const handleNewChatKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNewChat();
        }
      },
      [handleNewChat],
    );

    useEffect(() => {
      if (historyTitleEditable) {
        inputRef.current?.focus({ cursor: 'end' });
      }
    }, [historyTitleEditable]);

    useEffect(() => {
      if (variant === 'inline') {
        onHistoryPopoverVisibleChange?.(true);
      }
    }, [onHistoryPopoverVisibleChange, variant]);

    // 获取时间标签
    const getTimeKey = useCallback((diff: number): string => {
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes === 0 ? 'Just now' : `${minutes}m ago`;
      } else if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}h ago`;
      } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}d ago`;
      } else if (diff < 30 * 24 * 60 * 60 * 1000) {
        const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
        return `${weeks}w ago`;
      } else if (diff < 365 * 24 * 60 * 60 * 1000) {
        const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000));
        return `${months}mo ago`;
      }
      const years = Math.floor(diff / (365 * 24 * 60 * 60 * 1000));
      return `${years}y ago`;
    }, []);

    // 格式化历史记录
    const formatHistory = useCallback(
      (list: IChatHistoryItem[]) => {
        const now = new Date();
        const result = [] as { key: string; items: typeof list }[];

        list.forEach((item: IChatHistoryItem) => {
          const createdAt = new Date(item.createdAt);
          const diff = now.getTime() - createdAt.getTime();
          const key = getTimeKey(diff);

          const existingGroup = result.find((group) => group.key === key);
          if (existingGroup) {
            existingGroup.items.push(item);
          } else {
            result.push({ key, items: [item] });
          }
        });

        return result;
      },
      [getTimeKey],
    );

    // 渲染历史记录项
    const renderHistoryItem = useCallback(
      (item: IChatHistoryItem) => (
        <div
          key={item.id}
          data-testid={`chat-history-item-${item.id}`}
          className={cls(
            styles.chat_history_item,
            item.id === currentId ? styles.chat_history_item_selected : '',
            item.hasPendingPermission ? styles.chat_history_item_pending : '',
          )}
          onClick={() => handleHistoryItemSelect(item)}
        >
          {item.hasPendingPermission}
          <div className={styles.chat_history_item_content}>
            {!item.hasPendingPermission &&
              renderThreadStatusIcon(
                item.threadStatus,
                item.loading,
                `acp-thread-status-${item.id}-${item.threadStatus || 'default'}`,
              )}
            {item.hasPendingPermission && (
              <span
                data-testid={`acp-permission-pending-${item.id}`}
                className={cls(styles.chat_history_item_pending_icon, getIcon('bell'))}
                style={{ marginRight: 6, flexShrink: 0 }}
                title={localize('aiNative.acp.permissionPending')}
              />
            )}
            {/* <span
              data-testid={`thread-status-${item.id}`}
              style={{ fontSize: 11, marginRight: 4, color: '#888', flexShrink: 0 }}
            >
              [{item.threadStatus ?? (item.loading ? 'working' : 'idle')}]
            </span>*/}
            {!historyTitleEditable?.[item.id] ? (
              <span id={`chat-history-item-title-${item.id}`} className={styles.chat_history_item_title}>
                {item.title || 'Untitled'}
              </span>
            ) : (
              <Input
                className={styles.chat_history_item_title}
                defaultValue={item.title}
                ref={inputRef}
                onPressEnter={(e: any) => {
                  handleTitleEditComplete(item, e.target.value);
                }}
                onBlur={() => handleTitleEditCancel(item)}
              />
            )}
          </div>
          {/* ACP 模式：不显示删除按钮，会话由服务端管理 */}
        </div>
      ),
      [
        historyTitleEditable,
        handleHistoryItemSelect,
        handleTitleEditComplete,
        handleTitleEditCancel,
        currentId,
        inputRef,
      ],
    );

    // 渲染历史记录列表
    const renderHistory = useCallback(() => {
      const filteredList = historyList
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
          if (a.item.createdAt && b.item.createdAt && a.item.createdAt !== b.item.createdAt) {
            return b.item.createdAt - a.item.createdAt;
          }
          if (a.item.createdAt && !b.item.createdAt) {
            return -1;
          }
          if (!a.item.createdAt && b.item.createdAt) {
            return 1;
          }
          return b.index - a.index;
        })
        .slice(0, MAX_HISTORY_LIST)
        .map(({ item }) => item)
        .filter((item) => item.title !== undefined && item.title.includes(searchValue));

      const groupedHistoryList = formatHistory(filteredList);

      return (
        <div className={cls(variant === 'inline' && styles.chat_history_inline_content)}>
          <Input
            placeholder={localize('aiNative.operate.chatHistory.searchPlaceholder')}
            className={styles.chat_history_search}
            value={searchValue}
            onChange={handleSearchChange}
          />
          <div
            data-testid={variant === 'inline' ? 'acp-chat-history-inline' : 'acp-chat-history-popover'}
            className={cls(
              styles.chat_history_list,
              variant === 'inline' && styles.chat_history_inline_list,
              disabled && styles.chat_history_list_disabled,
            )}
          >
            {historyLoading ? (
              <div className={styles.chat_history_loading}>
                <Loading />
              </div>
            ) : (
              groupedHistoryList.map((group) => (
                <div key={group.key} style={{ padding: '4px' }}>
                  {group.items.map(renderHistoryItem)}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }, [
      historyList,
      searchValue,
      formatHistory,
      handleSearchChange,
      renderHistoryItem,
      historyLoading,
      disabled,
      variant,
    ]);

    // getPopupContainer 处理函数
    const getPopupContainer = useCallback((triggerNode: HTMLElement) => triggerNode.parentElement!, []);

    const renderNewChatAction = () => (
      <Popover id={'ai-chat-header-new'} position={PopoverPosition.top} title={newChatTitle}>
        {disabled ? (
          <div className={cls(styles.chat_history_header_actions_new, styles.chat_history_header_actions_new_disabled)}>
            <Loading />
          </div>
        ) : (
          <EnhanceIcon
            ariaLabel={newChatLabel}
            className={styles.chat_history_header_actions_new}
            iconClass='codicon codicon-add'
            onClick={handleNewChat}
            onKeyDown={handleNewChatKeyDown}
            onMouseDown={(event) => event.preventDefault()}
            role='button'
            tabIndex={0}
          />
        )}
      </Popover>
    );

    const renderMCPConfigAction = () => {
      if (variant !== 'inline' || !onOpenMCPConfig) {
        return null;
      }

      const mcpConfigTitle = localize('ai.native.mcp.config.title');

      return (
        <Popover id={'ai-chat-header-mcp-config'} position={PopoverPosition.top} title={mcpConfigTitle}>
          <EnhanceIcon
            ariaLabel={mcpConfigTitle}
            className={styles.chat_history_header_actions_mcp}
            iconClass={getIcon('mcp')}
            onClick={onOpenMCPConfig}
          />
        </Popover>
      );
    };

    const renderCollapseAction = () => {
      if (variant !== 'inline' || !onToggleHistoryCollapsed) {
        return null;
      }

      const collapseTitle = historyCollapsed
        ? localize('aiNative.operate.chatHistory.expand', 'Expand Chat History')
        : localize('aiNative.operate.chatHistory.collapse', 'Collapse Chat History');

      return (
        <Popover id={'ai-chat-header-collapse-history'} position={PopoverPosition.topLeft} title={collapseTitle}>
          <EnhanceIcon
            ariaLabel={collapseTitle}
            className={styles.chat_history_header_actions_collapse}
            iconClass={historyCollapsed ? 'codicon codicon-chevron-right' : 'codicon codicon-chevron-left'}
            onClick={onToggleHistoryCollapsed}
          />
        </Popover>
      );
    };

    const renderHeader = () => (
      <div className={styles.chat_history_header_bar}>
        <div className={styles.chat_history_header_title}>
          {variant === 'inline' ? (
            <div className={styles.chat_history_header_inline_actions}>
              {renderCollapseAction()}
              {renderMCPConfigAction()}
            </div>
          ) : (
            <span>{title}</span>
          )}
          {variant === 'inline' && pendingPermissionBadge && pendingPermissionBadge > 0 ? (
            <span data-testid='acp-pending-permission-badge' className={styles.pending_permission_badge_inline}>
              {pendingPermissionBadge > 99 ? '99+' : pendingPermissionBadge}
            </span>
          ) : null}
        </div>
        {variant === 'popover' ? (
          <div className={styles.chat_history_header_actions}>
            <Popover
              id='chat-history-header-actions-history'
              content={renderHistory()}
              trigger={PopoverTriggerType.click}
              position={PopoverPosition.bottomRight}
              title={localize('aiNative.operate.chatHistory.title')}
              getPopupContainer={getPopupContainer}
              onVisibleChange={onHistoryPopoverVisibleChange}
            >
              <div className={styles.chat_history_button_wrapper}>
                <div
                  data-testid='acp-chat-history-button'
                  className={styles.chat_history_header_actions_history}
                  title={localize('aiNative.operate.chatHistory.title')}
                >
                  <EnhanceIcon className={cls(styles.chat_history_header_actions_history, 'codicon codicon-history')} />
                  {pendingPermissionBadge && pendingPermissionBadge > 0 ? (
                    <span data-testid='acp-pending-permission-badge' className={styles.pending_permission_badge}>
                      {pendingPermissionBadge > 99 ? '99+' : pendingPermissionBadge}
                    </span>
                  ) : null}
                </div>
              </div>
            </Popover>
            {renderNewChatAction()}
          </div>
        ) : null}
      </div>
    );

    if (variant === 'inline') {
      return (
        <div
          data-testid={historyCollapsed ? 'acp-chat-history-collapsed' : undefined}
          className={cls(styles.chat_history_header, styles.chat_history_inline, className)}
        >
          {renderHeader()}
          {!historyCollapsed && renderHistory()}
        </div>
      );
    }

    return <div className={cls(styles.chat_history_header, className)}>{renderHeader()}</div>;
  },
);

export default AcpChatHistory;
