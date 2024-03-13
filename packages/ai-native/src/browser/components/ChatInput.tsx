import cls from 'classnames';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useInjectable, useLatest } from '@opensumi/ide-core-browser';
import { Icon, Popover, TextArea, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { localize, runWhenIdle, uuid } from '@opensumi/ide-core-common';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { AI_SLASH, IChatAgentService } from '../../common';
import { ChatSlashCommandItemModel } from '../chat/chat-model';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { IChatFeatureRegistry, IChatSlashCommandItem } from '../types';

import styles from './components.module.less';

const MAX_WRAPPER_HEIGHT = 160;
const INSTRUCTION_BOTTOM = 8;

interface IBlockProps extends IChatSlashCommandItem {
  command?: string;
  agentId?: string;
}

const Block = ({
  icon,
  name,
  description,
  agentId,
  command,
  selectedAgentId,
}: IBlockProps & { selectedAgentId?: string }) => (
  <div className={styles.block}>
    {icon && <EnhanceIcon className={icon} />}
    {name && <span className={styles.name}>{name}</span>}
    {description && <span className={styles.text}>{description}</span>}
    {!selectedAgentId && agentId && command && <span className={styles.agent_label}>@{agentId}</span>}
  </div>
);

const InstructionOptions = ({ onClick, bottom, trigger, agentId: selectedAgentId }) => {
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(IChatFeatureRegistry);

  const agentOptions = useMemo(() => {
    if (trigger === '@') {
      return chatAgentService.getAgents().map(
        (a) =>
          new ChatSlashCommandItemModel(
            {
              icon: '',
              name: `@${a.id} `,
              description: a.metadata.description,
            },
            '',
            a.id,
          ),
      );
    } else {
      return chatAgentService
        .getCommands()
        .map(
          (c) =>
            new ChatSlashCommandItemModel(
              {
                icon: '',
                name: `/ ${c.name} `,
                description: c.description,
              },
              c.name,
              c.agentId,
            ),
        )
        .filter((item) => !selectedAgentId || item.agentId === selectedAgentId);
    }
  }, [trigger, chatAgentService]);

  const options = useMemo(() => {
    if (trigger === '@') {
      return [];
    }

    return chatFeatureRegistry.getAllSlashCommand();
  }, [trigger, chatFeatureRegistry]);

  const handleClick = useCallback(
    (name: string | undefined, agentId?: string, command?: string) => {
      if (onClick) {
        onClick(name || '', agentId, command);
      }
    },
    [onClick],
  );

  return (
    <div className={styles.instruction_options_container} style={{ bottom: bottom + 'px' }}>
      <div className={styles.options}>
        <ul>
          {options.concat(agentOptions).map(({ icon, name, nameWithSlash, description, agentId, command }) => (
            <li key={`${agentId || ''}-${name}`} onMouseDown={() => handleClick(nameWithSlash, agentId, command)}>
              <Block
                icon={icon}
                name={nameWithSlash}
                description={description}
                agentId={agentId}
                command={command}
                selectedAgentId={selectedAgentId}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ThemeWidget = ({ themeBlock }) => (
  <div className={styles.theme_container}>
    <div className={styles.theme_block}>{themeBlock}</div>
  </div>
);

const AgentWidget = ({ agentId, command }) => (
  <div className={styles.theme_container}>
    <div className={styles.theme_block} style={{ marginRight: 4 }}>
      @{agentId}
    </div>
    {command && <div className={styles.theme_block}>/ {command}</div>}
  </div>
);

export interface IChatInputProps {
  onSend: (value: string, agentId?: string, command?: string) => void;
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
  agentId: string;
  setAgentId: (theme: string) => void;
  command: string;
  setCommand: (theme: string) => void;
}

// 指令命令激活组件
export const ChatInput = React.forwardRef((props: IChatInputProps, ref) => {
  const {
    onSend,
    onValueChange,
    enableOptions = false,
    disabled = false,
    defaultHeight = 32,
    autoFocus,
    setTheme,
    theme,
    setAgentId,
    agentId,
    setCommand,
    command,
  } = props;
  const [value, setValue] = useState(props.value || '');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(defaultHeight);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focus, setFocus] = useState(false);
  const [showExpand, setShowExpand] = useState(false);
  const [isExpand, setIsExpand] = useState(false);
  const instructionRef = useRef<HTMLDivElement | null>(null);
  const [placeholder, setPlaceHolder] = useState(localize('aiNative.chat.input.placeholder.default'));
  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(IChatFeatureRegistry);

  const currentAgentIdRef = useLatest(agentId);

  useImperativeHandle(ref, () => ({
    setInputValue: (v: string) => {
      setValue(v);
      runWhenIdle(() => {
        textareaRef.current?.focus();
      }, 120);
    },
  }));

  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value || '');
    }
  }, [props.value]);

  useEffect(() => {
    setTheme(theme || '');
    textareaRef.current?.focus();
    const defaultPlaceholder = localize('aiNative.chat.input.placeholder.default');

    if (!theme) {
      setPlaceHolder(defaultPlaceholder);
      return;
    }

    const findCommandHandler = chatFeatureRegistry.getSlashCommandHandlerBySlashName(theme);
    if (findCommandHandler && findCommandHandler.providerInputPlaceholder) {
      const editor = monacoCommandRegistry.getActiveCodeEditor();
      const placeholder = findCommandHandler.providerInputPlaceholder(value, editor);
      setPlaceHolder(placeholder || defaultPlaceholder);
    } else {
      setPlaceHolder(defaultPlaceholder);
    }
  }, [theme, chatFeatureRegistry]);

  useEffect(() => {
    acquireOptionsCheck(theme || '');
  }, [theme]);

  useEffect(() => {
    if (textareaRef && autoFocus) {
      textareaRef.current?.focus();
    }
  }, [textareaRef, autoFocus, props.value]);

  useEffect(() => {
    if (enableOptions) {
      if ((value === AI_SLASH || (value === '@' && chatAgentService.getAgents().length > 0)) && !isExpand) {
        setIsShowOptions(true);
      } else {
        setIsShowOptions(false);
      }
    }

    if (value.startsWith(AI_SLASH)) {
      const { value: newValue, nameWithSlash } = chatFeatureRegistry.parseSlashCommand(value);

      if (nameWithSlash) {
        setValue(newValue);
        setTheme(nameWithSlash);
        return;
      }
    }

    if (chatAgentService.getAgents().length) {
      const parsedInfo = chatAgentService.parseMessage(value, currentAgentIdRef.current);
      if (parsedInfo.agentId || parsedInfo.command) {
        setTheme('');
        setValue(parsedInfo.message);
        if (parsedInfo.agentId) {
          setAgentId(parsedInfo.agentId);
        }
        if (parsedInfo.command) {
          setCommand(parsedInfo.command);
        }
      }
    }

    runWhenIdle(() => {
      // 自适应高度
      if (textareaRef && textareaRef.current && value && !isExpand) {
        textareaRef.current.style.height = 0 + 'px';
        const scrollHeight = textareaRef.current.scrollHeight;
        textareaRef.current.style.height = Math.min(scrollHeight, MAX_WRAPPER_HEIGHT) + 'px';
        const wapperHeight = Math.min(scrollHeight + 12, MAX_WRAPPER_HEIGHT);

        setWrapperHeight(wapperHeight);
        if (wapperHeight > 68) {
          setShowExpand(true);
        } else {
          setShowExpand(false);
        }
      }
    });
  }, [textareaRef, value, enableOptions, chatFeatureRegistry]);

  useEffect(() => {
    if (!value) {
      setWrapperHeight(defaultHeight);
      setShowExpand(false);
      setIsExpand(false);
    }
  }, [value, wrapperHeight]);

  const handleInputChange = useCallback((value: string) => {
    setValue(value);
    if (onValueChange) {
      onValueChange(value);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (disabled) {
      return;
    }

    // 支持 command 不传内容
    if (agentId && (value.trim() || command)) {
      onSend(value, agentId, command);
      setValue('');
      setTheme('');
      setAgentId('');
      setCommand('');
      return;
    }

    if (theme) {
      const chatCommandHandler = chatFeatureRegistry.getSlashCommandHandlerBySlashName(theme);

      if (chatCommandHandler && chatCommandHandler.execute) {
        const editor = monacoCommandRegistry.getActiveCodeEditor();
        await chatCommandHandler.execute(
          value,
          (newValue: string) => {
            setValue('');
            onSend(theme + newValue);
            setTheme('');
          },
          editor,
        );
        return;
      }
    } else {
      setValue('');
      onSend(value);
      setTheme('');
    }
  }, [onSend, value, agentId, command, chatFeatureRegistry]);

  const acquireOptionsCheck = useCallback(
    (themeValue: string, agentId?: string, command?: string) => {
      // 目前仅 ext 的 command 有 agentId，因此有 agentId，则说明是 ext 注册的
      if (agentId) {
        setIsShowOptions(false);
        setTheme('');
        setAgentId(agentId);
        setCommand(command || '');
        if (textareaRef?.current) {
          const inputValue = textareaRef.current.value;
          if (inputValue === '@' || (command && inputValue === AI_SLASH)) {
            setValue('');
          }
          runWhenIdle(() => textareaRef.current?.focus());
        }
      } else if (themeValue) {
        setIsShowOptions(false);
        setAgentId('');
        setCommand('');

        const findCommand = chatFeatureRegistry.getSlashCommandBySlashName(themeValue);
        if (findCommand) {
          setTheme(findCommand.nameWithSlash);
        } else {
          setTheme('');
        }

        if (textareaRef && textareaRef.current) {
          textareaRef.current.focus();
          const inputValue = textareaRef.current.value;
          if (inputValue.length === 1 && inputValue.startsWith(AI_SLASH)) {
            setValue('');
          }
        }
      }
    },
    [textareaRef, chatFeatureRegistry],
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
      if (textareaRef.current?.selectionEnd === 0 && textareaRef.current?.selectionStart === 0) {
        setTheme('');
        if (agentId) {
          if (command) {
            setCommand('');
          } else {
            setAgentId('');
          }
        }
      }
    }
  };

  const handleFocus = () => {
    setFocus(true);
  };
  const handleBlur = useCallback(() => {
    setFocus(false);
    setIsShowOptions(false);
  }, [textareaRef]);

  const handleExpandClick = useCallback(() => {
    const expand = isExpand;
    setIsExpand(!expand);
    if (!expand) {
      const ele = document.querySelector('#ai_chat_left_container');
      const maxHeight = ele!.clientHeight - 68 - (theme ? 32 : 0) - 16;
      setWrapperHeight(maxHeight);
    } else {
      setWrapperHeight(defaultHeight);
      setShowExpand(false);
    }
  }, [isExpand]);

  return (
    <div className={cls(styles.chat_input_container, focus ? styles.active : null)}>
      {isShowOptions && (
        <div ref={instructionRef}>
          <InstructionOptions
            onClick={acquireOptionsCheck}
            bottom={optionsBottomPosition}
            trigger={value}
            agentId={agentId}
          />
        </div>
      )}
      {theme && <ThemeWidget themeBlock={theme} />}
      {agentId && <AgentWidget agentId={agentId} command={command} />}
      {showExpand && (
        <div className={styles.expand_icon} onClick={() => handleExpandClick()}>
          <Popover
            id={'ai_chat_input_expand'}
            title={localize(isExpand ? 'aiNative.chat.expand.unfullscreen' : 'aiNative.chat.expand.fullescreen')}
          >
            <Icon className={cls(isExpand ? getIcon('unfullscreen') : getIcon('fullescreen'))}></Icon>
          </Popover>
        </div>
      )}
      <TextArea
        ref={textareaRef}
        placeholder={placeholder}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        style={{
          height: wrapperHeight - 12 + 2 + 'px',
        }}
        value={value}
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
              {disabled ? (
                <div className={styles.ai_loading}>
                  <div className={styles.loader}></div>
                  <div className={styles.loader}></div>
                  <div className={styles.loader}></div>
                </div>
              ) : (
                <Popover
                  id={`ai_chat_input_send_${uuid(4)}`}
                  title={localize('aiNative.chat.enter.send')}
                  disable={disabled}
                >
                  <EnhanceIcon
                    wrapperClassName={styles.send_icon}
                    className={getIcon('send-solid')}
                    onClick={() => handleSend()}
                  />
                </Popover>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
});
