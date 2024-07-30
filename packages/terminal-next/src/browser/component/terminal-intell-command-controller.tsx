import React, { useEffect, useState } from 'react';

import { Emitter } from '@opensumi/ide-core-common';

import styles from './terminal-intell-command-controller.module.less';

export interface SmartCommandDesc {
  description: string;
  command: string;
}

// 支持键盘选择的列表
export const KeyboardSelectableList = (props: {
  items: { description: string; command: string }[];
  handleSuggestionClick: (command: string) => void;
  controller?: Emitter<string>;
  noListen?: boolean;
}) => {
  const { items, handleSuggestionClick, noListen = false, controller } = props;
  // 选中项的索引，默认为最后一个
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // 处理键盘事件
  const handleKeyPress = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp': // 上键
        setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        break;
      case 'ArrowDown': // 下键
        setSelectedIndex((prevIndex) =>
          Math.min(prevIndex + 1, items.length - 1),
        );
        break;
      case 'Enter': // 回车键
        if (items[selectedIndex]) {
          handleSuggestionClick(items[selectedIndex].command);
        }
        break;
      default:
        break;
    }
  };

  // 添加全局键盘事件监听器
  useEffect(() => {
    if (noListen) {return;}
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [items, selectedIndex]);

  useEffect(() => {
    if (!controller) {return;}
    const disposable = controller.event((e: string) => {
      if (e === 'ArrowUp') {
        setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      }
      if (e === 'ArrowDown' || e === 'Tab') {
        setSelectedIndex((prevIndex) =>
          Math.min(prevIndex + 1, items.length - 1),
        );
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

  useEffect(() => {
    // HACK 定位到顶部
    setSelectedIndex(0);
  }, [items]);

  return (
    <div className={styles.suggestions}>
      {items.map((cmd, index) => (
        <div
          key={index}
          className={styles.suggestionItem}
          style={{ backgroundColor: index === selectedIndex ? 'var(--selection-background)' : '' }}
          onClick={() => handleSuggestionClick(cmd.command)}
        >
          <div className={styles.suggestionItemContainer}>
            <div className={styles.suggestionDesc}>{cmd.description}</div>
            <div className={styles.suggestionCmd}>{cmd.command}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const TerminalIntellCommandController = (props: {
  suggestions: SmartCommandDesc[];
  controller: Emitter<string>;
  onSuggestion: (suggestion: string) => void;
}) => {
  const { suggestions, controller, onSuggestion } = props;

  return (
    <div style={{ position: 'relative' }}>
      {suggestions.length > 0 && (
        <KeyboardSelectableList
          items={suggestions}
          controller={controller}
          handleSuggestionClick={onSuggestion}
          noListen
        />
      )}
    </div>
  );
};
