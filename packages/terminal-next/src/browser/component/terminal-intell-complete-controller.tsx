import cls from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { Emitter } from '@opensumi/ide-core-common';

import styles from './terminal-intell-complete-controller.module.less';

export interface SmartCommandDesc {
  description: string;
  command: string;
  icon: string;
}

interface PopupPosition {
  top: number;
  left: number;
}

// 支持键盘选择的列表
const SelectableList = (props: {
  items: { description: string; command: string; icon: string }[];
  handleSuggestionClick: (command: string) => void;
  controller?: Emitter<string>;
  noListen?: boolean;
}) => {
  const { items, handleSuggestionClick, controller } = props;
  // 选中项的索引，默认为最后一个
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ top: 0, left: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const isScrollIntoViewTriggeredRef = useRef(false); // 滚动是否是通过编程触发 (非用户滚动)

  useEffect(() => {
    if (!controller) {
      return;
    }
    const disposable = controller.event((e: string) => {
      if (e === 'ArrowUp') {
        setSelectedIndex((prevIndex) => {
          if (prevIndex === 0) {
            return items.length - 1;
          }
          return Math.max(prevIndex - 1, 0);
        });
      }
      if (e === 'ArrowDown' || e === 'Tab') {
        // 走到最下面之后按一下返回顶部
        setSelectedIndex((prevIndex) => {
          if (prevIndex + 1 >= items.length) {
            return 0;
          }
          return Math.min(prevIndex + 1, items.length - 1);
        });
      }
      if (e === 'Enter') {
        if (items[selectedIndex]) {
          handleSuggestionClick(items[selectedIndex].command);
        }
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [controller, selectedIndex, items]);

  // 确保选中项用户可见，比如说通过方向键上下选到了列表 overflow 的部分，此时就需要触发一个自动滚动
  useEffect(() => {
    if (selectedIndex > -1 && selectedItemRef.current && listRef.current) {
      // smooth 滚动会导致高度计算的延迟，所以使用 instant 滚动
      selectedItemRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });

      // 对于这种编程触发的滚动的情况下，做一个标记
      isScrollIntoViewTriggeredRef.current = true;
      setTimeout(() => {
        isScrollIntoViewTriggeredRef.current = false;
      }, 100);

      // 等待滚动渲染后计算
      setTimeout(() => {
        const itemRect = selectedItemRef.current?.getBoundingClientRect();
        if (itemRect) {
          // Calculate the position of the popup
          setPopupPosition({
            top: itemRect.top,
            left: itemRect.right + 10, // 向右偏移 10 px 作为 padding 的补偿
          });
        }
      }, 0);
    }
  }, [selectedIndex, items]);

  // 用户滚动 Complete 列表时，隐藏右侧提示框
  useEffect(() => {
    if (selectedIndex > -1 && listRef.current && popupPosition) {
      const handleScroll = () => {
        const { top, left } = popupPosition;
        // 两种情况:
        // 1. 如果提示框已经被隐藏，也就是 left top 是 0，那就不必再次触发
        // 2. 如果是 scrollIntoView 编程触发的滚动，那么这种滚动不要隐藏右侧提示框
        if (top === 0 || left === 0 || isScrollIntoViewTriggeredRef.current) {
          return;
        }
        setPopupPosition({ top: 0, left: 0 });
      };

      listRef.current?.addEventListener('scroll', handleScroll);

      return () => {
        listRef.current?.removeEventListener('scroll', handleScroll);
      };
    }
  }, [selectedIndex, popupPosition]);

  useEffect(() => {
    // HACK 定位到顶部
    // TODO 这里需要考虑做一下稳定性，比如说 items 变化时，寻找相同的 commands，保证用户视觉上的稳定
    setSelectedIndex(0);
  }, [items]);

  const selectedItem = items[selectedIndex];

  return (
    <div className={cls('monaco-workbench monaco-component', styles.suggestions)}>
      <div className={styles.suggestionList} ref={listRef}>
        {items.map((cmd, index) => (
          <div
            key={index}
            className={styles.suggestionItem}
            ref={index === selectedIndex ? selectedItemRef : null}
            style={{
              backgroundColor: index === selectedIndex ? 'var(--vscode-editorSuggestWidget-selectedBackground)' : '',
              color: index === selectedIndex ? 'var(--vscode-editorSuggestWidget-selectedForeground)' : '',
            }}
            onClick={() => handleSuggestionClick(cmd.command)}
          >
            <div className={styles.suggestionItemContainer}>
              <div className={styles.suggestionIcon}>{cmd.icon}</div>
              <div className={styles.suggestionCmd}>{cmd.command}</div>
              <div className={styles.suggestionDesc}>{cmd.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div>
        {selectedItem && popupPosition.top > 0 && popupPosition.left > 0 && (
          <div
            className={cls(styles.suggestionItemExtraContainer, styles.extraContainerRight)}
            style={{ top: `${popupPosition.top}px`, left: `${popupPosition.left}px` }}
          >
            <div className={styles.suggestionItemExtraCommand}>{selectedItem.command}</div>
            <div className={styles.suggestionItemExtraDescription}>{selectedItem.description}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const TerminalIntellCompleteController = (props: {
  suggestions: SmartCommandDesc[];
  controller: Emitter<string>;
  onSuggestion: (suggestion: string) => void;
  onClose: () => void;
}) => {
  const { suggestions, controller, onSuggestion, onClose } = props;
  const modalRef = useRef<HTMLDivElement>(null);

  // 点击弹框之外的区域关闭弹框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose(); // 调用传入的 onClose 函数来关闭弹框
      }
    };

    // 监听点击事件
    document.addEventListener('mousedown', handleClickOutside);

    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div style={{ position: 'relative' }} ref={modalRef}>
      {suggestions.length > 0 && (
        <SelectableList items={suggestions} controller={controller} handleSuggestionClick={onSuggestion} noListen />
      )}
    </div>
  );
};
