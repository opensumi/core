import cls from 'classnames';
import React, { FC, memo, useCallback, useEffect, useRef, useState } from 'react';

import { Icon, Input, Loading, Popover, PopoverPosition, PopoverTriggerType, getIcon } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-browser';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';

import styles from './chat-history.module.less';

export interface IChatHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  loading: boolean;
}

export interface IChatHistoryProps {
  title: string;
  historyList: IChatHistoryItem[];
  currentId?: string;
  className?: string;
  onNewChat: () => void;
  onHistoryItemSelect: (item: IChatHistoryItem) => void;
  onHistoryItemDelete: (item: IChatHistoryItem) => void;
  onHistoryItemChange: (item: IChatHistoryItem, title: string) => void;
}

// 最大历史记录数
const MAX_HISTORY_LIST = 100;

const ChatHistory: FC<IChatHistoryProps> = memo(
  ({
    title,
    historyList,
    currentId,
    onNewChat,
    onHistoryItemSelect,
    onHistoryItemChange,
    onHistoryItemDelete,
    className,
  }) => {
    const [historyTitleEditable, setHistoryTitleEditable] = useState<{
      [key: string]: boolean;
    } | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const inputRef = useRef<any>(null);

    // 处理搜索输入变化
    const handleSearchChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(event.target.value);
      },
      [searchValue],
    );

    // 处理历史记录项选择
    const handleHistoryItemSelect = useCallback(
      (item: IChatHistoryItem) => {
        onHistoryItemSelect(item);
        setSearchValue('');
      },
      [onHistoryItemSelect, searchValue],
    );

    // 处理标题编辑
    const handleTitleEdit = useCallback(
      (item: IChatHistoryItem) => {
        setHistoryTitleEditable({
          [item.id]: true,
        });
      },
      [historyTitleEditable],
    );

    // 处理标题编辑完成
    const handleTitleEditComplete = useCallback(
      (item: IChatHistoryItem, newTitle: string) => {
        setHistoryTitleEditable({
          [item.id]: false,
        });
        onHistoryItemChange(item, newTitle);
      },
      [onHistoryItemChange, historyTitleEditable],
    );

    // 处理标题编辑取消
    const handleTitleEditCancel = useCallback(
      (item: IChatHistoryItem) => {
        setHistoryTitleEditable({
          [item.id]: false,
        });
      },
      [historyTitleEditable],
    );

    // 处理新建聊天
    const handleNewChat = useCallback(() => {
      onNewChat();
    }, [onNewChat]);

    useEffect(() => {
      if (historyTitleEditable) {
        inputRef.current?.focus({ cursor: 'end' });
      }
    }, [historyTitleEditable]);

    // 处理删除历史记录
    const handleHistoryItemDelete = useCallback(
      (item: IChatHistoryItem) => {
        onHistoryItemDelete(item);
      },
      [onHistoryItemDelete],
    );

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
          const updatedAt = new Date(item.updatedAt);
          const diff = now.getTime() - updatedAt.getTime();
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
          className={cls(
            styles['dm-chat-history-item'],
            item.id === currentId ? styles['dm-chat-history-item-selected'] : '',
          )}
          onClick={() => handleHistoryItemSelect(item)}
        >
          <div className={styles['dm-chat-history-item-content']}>
            {item.loading ? (
              <Loading />
            ) : (
              <Icon icon='message' style={{ width: '16px', height: '16px', marginRight: 4 }} />
            )}
            {!historyTitleEditable?.[item.id] ? (
              <span id={`dm-chat-history-item-title-${item.id}`} className={styles['dm-chat-history-item-title']}>
                {item.title}
              </span>
            ) : (
              <Input
                className={styles['dm-chat-history-item-title']}
                defaultValue={item.title}
                ref={inputRef}
                onPressEnter={(e: any) => {
                  handleTitleEditComplete(item, e.target.value);
                }}
                onBlur={() => handleTitleEditCancel(item)}
              />
            )}
          </div>
          <div className={styles['dm-chat-history-item-actions']}>
            {/* <EditOutlined
              title={localize('aiNative.operate.chatHistory.edit')}
              style={{ marginRight: 8 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTitleEdit(item);
              }}
            /> */}
            <EnhanceIcon
              className={cls(styles['dm-chat-history-item-actions-delete'], getIcon('delete'))}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHistoryItemDelete(item);
              }}
              ariaLabel={localize('aiNative.operate.chatHistory.delete')}
            />
          </div>
        </div>
      ),
      [
        historyTitleEditable,
        handleHistoryItemSelect,
        handleTitleEditComplete,
        handleTitleEditCancel,
        handleTitleEdit,
        handleHistoryItemDelete,
        currentId,
        inputRef,
      ],
    );

    // 渲染历史记录列表
    const renderHistory = useCallback(() => {
      const filteredList = historyList
        .slice(0, MAX_HISTORY_LIST)
        .filter((item) => item.title && item.title.includes(searchValue));

      const groupedHistoryList = formatHistory(filteredList);

      return (
        <div>
          <Input
            placeholder={localize('aiNative.operate.chatHistory.searchPlaceholder')}
            style={{ width: '100%', maxWidth: '100%' }}
            value={searchValue}
            onChange={handleSearchChange}
          />
          <div className={styles['dm-chat-history-list']}>
            {groupedHistoryList.map((group) => (
              <div key={group.key} style={{ padding: '4px' }}>
                <div className={styles['dm-chat-history-time']}>{group.key}</div>
                {group.items.map(renderHistoryItem)}
              </div>
            ))}
          </div>
        </div>
      );
    }, [historyList, searchValue, formatHistory, handleSearchChange, renderHistoryItem]);

    // getPopupContainer 处理函数
    const getPopupContainer = useCallback((triggerNode: HTMLElement) => triggerNode.parentElement!, []);

    return (
      <div className={cls(styles['dm-chat-history-header'], className)}>
        <div className={styles['dm-chat-history-header-title']}>
          <span>{title}</span>
        </div>
        <div className={styles['dm-chat-history-header-actions']}>
          <Popover
            id='dm-chat-history-header-actions-history'
            content={renderHistory()}
            trigger={PopoverTriggerType.click}
            position={PopoverPosition.bottomRight}
            title={localize('aiNative.operate.chatHistory.title')}
            getPopupContainer={getPopupContainer}
          >
            <div
              className={styles['dm-chat-history-header-actions-history']}
              title={localize('aiNative.operate.chatHistory.title')}
            >
              <EnhanceIcon
                className={cls(styles['dm-chat-history-header-actions-history'], 'codicon codicon-history')}
              />
            </div>
          </Popover>
          <Popover
            id={'ai-chat-header-close'}
            position={PopoverPosition.top}
            title={localize('aiNative.operate.newChat.title')}
          >
            <EnhanceIcon
              className={cls(styles['dm-chat-history-header-actions-new'], getIcon('plus'))}
              onClick={handleNewChat}
            />
          </Popover>
        </div>
      </div>
    );
  },
);

export default ChatHistory;
