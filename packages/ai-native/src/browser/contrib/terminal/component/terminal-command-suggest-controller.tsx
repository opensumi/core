import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Emitter, localize } from '@opensumi/ide-core-browser';
import { Input, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';

import { ITerminalCommandSuggestionDesc } from '../../../../common';

import styles from './terminal-command-suggest-controller.module.less';

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
        setSelectedIndex((prevIndex) => Math.min(prevIndex + 1, items.length - 1));
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
    if (noListen) {
      return;
    }
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [items, selectedIndex]);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const disposable = controller.event((e: string) => {
      if (e === 'ArrowUp') {
        setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      }
      if (e === 'ArrowDown' || e === 'Tab') {
        setSelectedIndex((prevIndex) => Math.min(prevIndex + 1, items.length - 1));
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

interface CommandLineInterfaceProps {
  onEscTriggered: () => void;
  onSuggestionClick: (command: string) => void;
  onDescription?: (description: string) => void;
  getAICommandSuggestions: (
    commandDescription: string,
    doneCallback: () => void,
    thinkingCallback: () => void,
    suggestionCallback: (suggestions: ITerminalCommandSuggestionDesc[]) => void,
  ) => void;
  cancelAIRequst?: () => void;
}

export const AITerminalPrompt = (props: CommandLineInterfaceProps) => {
  const { onEscTriggered, onSuggestionClick, getAICommandSuggestions, cancelAIRequst } = props;
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<ITerminalCommandSuggestionDesc[]>([]);
  const [loading, setLoading] = useState(false);
  const [statMsg, setStatMsg] = useState(localize('terminal.ai.escClose'));
  const modalRef = useRef<HTMLDivElement>(null);

  const searchAICommands = useCallback(
    async (desc: string) => {
      setLoading(true);
      setStatMsg(localize('terminal.ai.requesting'));
      getAICommandSuggestions(
        desc,
        () => {
          setLoading(false);
          setStatMsg(localize('terminal.ai.selectHint'));
        },
        () => {
          setLoading(true);
          setStatMsg(localize('terminal.ai.thinking'));
        },
        (suggestions) => {
          setSuggestions([...suggestions].reverse());
        },
      );
    },
    [suggestions],
  );

  const debouncedSearch = useCallback(
    debounce((desc: string) => {
      searchAICommands(desc);
    }, 1000),
    [],
  ); // 延迟 1 秒

  // ESC 事件监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        onEscTriggered();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 点击弹框之外的区域关闭弹框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onEscTriggered(); // 调用传入的 onClose 函数来关闭弹框
      }
    };

    // 监听点击事件
    document.addEventListener('mousedown', handleClickOutside);

    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onEscTriggered]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputContent = e.target.value;
    setInput(inputContent);
    // 根据输入更新建议列表
    if (inputContent.length > 0 && !inputContent.includes("'")) {
      debouncedSearch(inputContent);
    }
    if (inputContent.length === 0) {
      setSuggestions([]);
      setStatMsg(localize('terminal.ai.escClose'));
      cancelAIRequst && cancelAIRequst();
    }
  };

  const handleSubmit = useCallback(() => {
    searchAICommands(input);
  }, [input]);

  const handleSuggestionClick = (command: string) => {
    // 处理点击建议命令，这里只是简单地填充输入
    onSuggestionClick(command);
  };

  return (
    <div className={styles.container} ref={modalRef}>
      <div className={styles.header}>
        <div style={{ flex: '1' }}>{localize('terminal.ai.headerHint')}</div>
        <div>
          <EnhanceIcon
            className={getIcon('close1')}
            onClick={() => {
              onEscTriggered();
            }}
          />
        </div>
      </div>
      <div style={{ position: 'relative', marginLeft: '-14px' }}>
        {suggestions.length > 0 && (
          <KeyboardSelectableList items={suggestions} handleSuggestionClick={handleSuggestionClick} />
        )}
      </div>

      <div className={styles.inputContainer}>
        <Input
          type='text'
          value={input}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              // 阻止默认的键盘上下方向键
              event.preventDefault();
            }
          }}
          onChange={handleInputChange}
          onPressEnter={() => handleSubmit()}
          placeholder={localize('terminal.ai.inputHint')}
          className={styles.input}
          autoFocus
        />
        {loading ? (
          <div className={styles.ai_loading}>
            <div className={styles.loader}></div>
            <div className={styles.loader}></div>
            <div className={styles.loader}></div>
          </div>
        ) : (
          <EnhanceIcon
            wrapperClassName={styles.send_icon}
            className={getIcon('send-solid')}
            onClick={() => {
              debouncedSearch(input);
            }}
          />
        )}
      </div>

      <div className={styles.statusContainer}>{statMsg}</div>
    </div>
  );
};
