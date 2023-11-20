import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { message } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, Input, Popover, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { uuid } from '@opensumi/ide-core-common';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { InstructionEnum } from '../../common';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';

const MAX_WRAPPER_HEIGHT = 160;
const SHOW_EXPEND_HEIGHT = 68;
const INSTRUCTION_BOTTOM = 8;

const PLACEHOLDER = {
  DEFAULT: '可以问我任何问题，或键入主题 ”/“ ',
  CODE: '请输入或者粘贴代码',
};

const VALUE_START_WITH_THEME = /\/(\s?)(ide|explain|comments|test|searchdoc|run|optimize)\s/i;

interface IBlockProps {
  icon?: string;
  name: string;
  text?: string;
  onClick?: () => void;
}

const Block = ({ icon, name, onClick, text }: IBlockProps) => (
  <div className={styles.block} onClick={onClick}>
    {icon && <EnhanceIcon className={icon} />}
    {name && <span className={styles.name}>{name}</span>}
    {text && <span className={styles.text}>{text}</span>}
  </div>
);

// 指令列表
const optionsList: IBlockProps[] = [
  {
    name: InstructionEnum.aiExplainKey,
    text: '解释代码',
  },
  {
    name: InstructionEnum.aiTestKey,
    text: '生成单测',
  },
  {
    name: InstructionEnum.aiOptimzeKey,
    text: '优化代码',
  },
  {
    name: InstructionEnum.aiSumiKey,
    text: '执行 IDE 相关命令',
  },
  {
    name: InstructionEnum.aiSearchDocKey,
    text: '搜索文档内容',
  },
  // {
  //   name: InstructionEnum.aiSearchCodeKey,
  //   text: '搜索代码仓库中的内容',
  // },
];

// 指令命令激活组件
const InstructionOptions = ({ onClick, bottom }) => {
  const [commonlyUsed, setCommonlyUsed] = useState<IBlockProps[]>([]);
  const [options, setOptions] = useState<IBlockProps[]>([]);

  useEffect(() => {
    setOptions(optionsList);
  }, []);

  const handleClick = useCallback(
    (name: string | undefined) => {
      if (onClick) {
        onClick(name || '');
      }
    },
    [onClick],
  );

  return (
    <div className={styles.instruction_options_container} style={{ bottom: bottom + 'px' }}>
      <div className={styles.options}>
        <ul>
          {options.map(({ icon, name, text }) => (
            <li key={name} onMouseDown={() => handleClick(name)}>
              <Block icon={icon} name={name} text={text} />
            </li>
          ))}
        </ul>
      </div>
      {commonlyUsed.length > 0 && (
        <div className={styles.commonly_used}>
          <span>常用指令：</span>
          {commonlyUsed.map(({ icon, name }, i) => (
            <Block key={i} icon={icon} name={name} />
          ))}
        </div>
      )}
    </div>
  );
};

const ThemeWidget = ({ themeBlock }) => (
  <div className={styles.theme_container}>
    <div className={styles.theme_block}>{themeBlock}</div>
  </div>
);

export interface IChatInputProps {
  onSend: (value: string) => void;
  onValueChange?: (value: string) => void;
  onExpand?: (value: boolean) => void;
  placeholder?: string;
  enableOptions?: boolean;
  disabled?: boolean;
  sendBtnClassName?: string;
  defaultHeight?: number;
  value?: string;
  autoFocus?: boolean;
  theme?: string | null;
  setTheme: (theme: string | null) => void;
}

// 指令命令激活组件
export const ChatInput = (props: IChatInputProps) => {
  const {
    onSend,
    onValueChange,
    enableOptions = false,
    disabled = false,
    defaultHeight = 32,
    autoFocus,
    setTheme,
    theme,
  } = props;
  const [value, setValue] = useState(props.value || '');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(defaultHeight);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focus, setFocus] = useState(false);
  const [showExpand, setShowExpand] = useState(false);
  const [isExpand, setIsExpand] = useState(false);
  const instructionRef = useRef<HTMLDivElement | null>(null);
  const [placeholder, setPlaceHolder] = useState(PLACEHOLDER.DEFAULT);
  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  useEffect(() => {
    setTheme(props.theme || '');
    inputRef.current?.focus();

    if (
      theme === InstructionEnum.aiTestKey ||
      theme === InstructionEnum.aiExplainKey ||
      theme === InstructionEnum.aiOptimzeKey
    ) {
      setPlaceHolder(PLACEHOLDER.CODE);
    } else {
      setPlaceHolder(PLACEHOLDER.DEFAULT);
    }
  }, [props.theme]);

  useEffect(() => {
    acquireOptionsCheck(props.theme || '');
  }, [props.theme]);

  useEffect(() => {
    if (inputRef && autoFocus) {
      inputRef.current?.focus();
    }
  }, [inputRef, autoFocus, props.value]);

  useEffect(() => {
    if (enableOptions) {
      if (value.length === 1 && value.startsWith('/') && !isExpand) {
        setIsShowOptions(true);
      } else {
        setIsShowOptions(false);
      }
    }

    const match = value.match(VALUE_START_WITH_THEME);
    if (match) {
      const matchValue = match[0];
      const matchString = match[2].toLowerCase();
      const resValue = value.replace(matchValue, '');
      const matchTheme = Object.values(InstructionEnum).find((v) =>
        v.trim().slice(2).toLowerCase() === matchString ? true : false,
      );
      if (matchTheme) {
        setValue(resValue);
        setTheme(matchTheme);
        return;
      }
    }

    // 自适应高度
    if (inputRef && inputRef.current && !isExpand) {
      inputRef.current.style.height = 0 + 'px';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollHeight, MAX_WRAPPER_HEIGHT) + 'px';
      const wapperHeight = Math.min(scrollHeight + 12, MAX_WRAPPER_HEIGHT);

      setWrapperHeight(wapperHeight);
      if (wapperHeight > 68) {
        setShowExpand(true);
      } else {
        setShowExpand(false);
      }
    }
  }, [inputRef, value, enableOptions]);

  const handleInputChange = useCallback((value: string) => {
    setValue(value);
    if (onValueChange) {
      onValueChange(value);
    }
  }, []);

  const handleSend = useCallback(() => {
    if (disabled) {
      return;
    }

    const editor = monacoCommandRegistry.getActiveCodeEditor();
    let selectCode;
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        selectCode = editor.getModel()?.getValueInRange(selection);
      }
    }

    let preText = '';
    if (theme) {
      preText = theme;
    }

    if (value.trim() && onSend) {
      setValue('');
      onSend(preText + value);
      isExpand ? resetStatus() : resetStatus(true);
      return;
    }

    // 代码区选中状况
    if (theme && selectCode && !value.trim()) {
      if (theme === InstructionEnum.aiSumiKey) {
        message.info('很抱歉，您并未输入任何命令，可以试试这么问：/IDE 设置主题');
        return;
      }
      onSend(preText + ` \`\`\`\n ${selectCode} \n\`\`\``);
      isExpand ? resetStatus() : resetStatus(true);
      return;
    }

    // 报错提示
    if (theme && !value.trim() && !selectCode) {
      message.info('很抱歉，您并未选中或输入任何代码，请先选中或输入代码');
    }
  }, [onSend, value]);

  const acquireOptionsCheck = useCallback(
    (themeValue: string) => {
      if (themeValue) {
        setIsShowOptions(false);

        // 设置 slash widget 块
        const regex = /\/\s(\w+)\s/;
        const match = themeValue.match(regex);
        if (match) {
          const keyword = match[0];
          if (optionsList.find(({ name }) => name === keyword)) {
            setTheme(keyword);
          }
        } else {
          setTheme('');
        }

        if (inputRef && inputRef.current) {
          inputRef.current.focus();
          const inputValue = inputRef.current.value;
          if (inputValue.length === 1 && inputValue.startsWith('/')) {
            setValue('');
          }
        }
      }
    },
    [inputRef],
  );

  const optionsBottomPosition = useMemo(() => {
    const customBottom = INSTRUCTION_BOTTOM + wrapperHeight;
    if (isExpand) {
      setIsShowOptions(false);
    }
    return customBottom;
  }, [wrapperHeight]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      if (!event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    } else if (event.key === 'Backspace') {
      if (inputRef.current?.selectionEnd === 0 && inputRef.current?.selectionStart === 0) {
        setTheme('');
      }
    }
  };

  const handleFocus = () => {
    setFocus(true);
  };
  const handleBlur = useCallback(() => {
    setFocus(false);
    setIsShowOptions(false);
  }, [inputRef]);

  const handleExpandClick = useCallback(() => {
    const expand = isExpand;
    setIsExpand(!expand);
    if (!expand) {
      const ele = document.querySelector('#ai_chat_left_container');
      // ai_chat_left_container - (padding + header_operate + border ) - theme_container - padding
      const maxHeight = ele!.clientHeight - 68 - (theme ? 32 : 0) - 16;
      setWrapperHeight(maxHeight);
    } else {
      setWrapperHeight(defaultHeight);
      setShowExpand(false);
    }
  }, [isExpand]);

  const resetStatus = (clearExpand?: boolean) => {
    setWrapperHeight(defaultHeight);
    if (clearExpand) {
      setShowExpand(false);
    }
    setIsExpand(false);
    setTheme('');
  };

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && (
        <div ref={instructionRef}>
          <InstructionOptions onClick={acquireOptionsCheck} bottom={optionsBottomPosition} />
        </div>
      )}
      {theme && <ThemeWidget themeBlock={theme} />}
      {showExpand && (
        <div className={styles.expand_icon} onClick={() => handleExpandClick()}>
          <Popover id={'ai_chat_input_expand'} title={isExpand ? '收起' : '展开全屏'}>
            <Icon className={cls(isExpand ? getIcon('unfullscreen') : getIcon('fullescreen'))}></Icon>
          </Popover>
        </div>
      )}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        style={{
          // 2px 额外宽度 否则会有滚动条
          height: wrapperHeight - 12 + 2 + 'px',
          // maxHeight: wrapperHeight-16 + 'px',
          // minHeight: wrapperHeight-16 + 'px',
        }}
        value={value}
        type={'textarea'}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onValueChange={handleInputChange}
        disabled={disabled}
        className={styles.input_wrapper}
        addonAfter={
          <div className={styles.input_icon_container}>
            <div
              className={cls(
                styles.send_chat_btn,
                focus && styles.active,
                disabled && styles.disabled,
                props.sendBtnClassName,
              )}
            >
              <Popover id={`ai_chat_input_send_${uuid(4)}`} title={'Enter 发送'} disable={disabled}>
                <Icon
                  className={cls(disabled ? getIcon('more') : getIcon('send1'), styles.send_icon)}
                  onClick={() => handleSend()}
                />
              </Popover>
            </div>
          </div>
        }
      />
    </div>
  );
};
