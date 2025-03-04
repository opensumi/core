import cls from 'classnames';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useInjectable, useLatest } from '@opensumi/ide-core-browser';
import { Icon, Popover, PopoverPosition, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/interactive-input/index';
import { ChatAgentViewServiceToken, ChatFeatureRegistryToken, localize, runWhenIdle } from '@opensumi/ide-core-common';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { AT_SIGN_SYMBOL, IChatAgentService, SLASH_SYMBOL } from '../../common';
import { ChatAgentViewService } from '../chat/chat-agent.view.service';
import { ChatSlashCommandItemModel } from '../chat/chat-model';
import { ChatProxyService } from '../chat/chat-proxy.service';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { IChatSlashCommandItem } from '../types';

import styles from './components.module.less';

const INSTRUCTION_BOTTOM = 8;
const EXPAND_CRITICAL_HEIGHT = 68;

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
}: IBlockProps & { selectedAgentId?: string }) => {
  const renderAgent = useMemo(() => {
    if (!selectedAgentId && agentId && agentId !== ChatProxyService.AGENT_ID && command) {
      return <span className={styles.agent_label}>@{agentId}</span>;
    }
    return null;
  }, []);

  return (
    <div className={styles.block}>
      {icon && <EnhanceIcon className={icon} />}
      {name && <span className={styles.name}>{name}</span>}
      {description && <span className={styles.text}>{description}</span>}
      {renderAgent}
    </div>
  );
};

const InstructionOptions = ({ onClick, bottom, trigger, agentId: selectedAgentId }) => {
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatAgentViewService = useInjectable<ChatAgentViewService>(ChatAgentViewServiceToken);

  const options = useMemo(() => {
    if (trigger === AT_SIGN_SYMBOL) {
      return chatAgentViewService.getRenderAgents().map(
        (a) =>
          new ChatSlashCommandItemModel(
            {
              icon: '',
              name: `${AT_SIGN_SYMBOL}${a.id} `,
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
                name: `${SLASH_SYMBOL} ${c.name} `,
                description: c.description,
              },
              c.name,
              c.agentId,
            ),
        )
        .filter((item) => !selectedAgentId || item.agentId === selectedAgentId);
    }
  }, [trigger, chatAgentService]);

  const handleClick = useCallback(
    (name: string | undefined, agentId?: string, command?: string) => {
      if (onClick) {
        onClick(name || '', agentId, command);
      }
    },
    [onClick],
  );

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={styles.instruction_options_container} style={{ bottom: bottom + 'px' }}>
      <div className={styles.options}>
        <ul>
          {options.map(({ icon, name, nameWithSlash, description, agentId, command }) => (
            <li key={`${agentId || ''}-${name}`} onMouseDown={() => handleClick(nameWithSlash, agentId, command)}>
              <Block
                icon={icon}
                name={name}
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
    {agentId !== ChatProxyService.AGENT_ID && (
      <div className={styles.theme_block} style={{ marginRight: 4 }}>
        @{agentId}
      </div>
    )}
    {command && (
      <div className={styles.theme_block}>
        {SLASH_SYMBOL} {command}
      </div>
    )}
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
  setAgentId: (id: string) => void;
  defaultAgentId?: string;
  command: string;
  setCommand: (command: string) => void;
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
    agentId: propsAgentId,
    defaultAgentId,
    setCommand,
    command,
    sendBtnClassName,
  } = props;
  const agentId = propsAgentId || defaultAgentId;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const instructionRef = useRef<HTMLDivElement | null>(null);

  const [value, setValue] = useState(props.value || '');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [inputHeight, setInputHeight] = useState<number>(defaultHeight);
  const [focus, setFocus] = useState(false);
  const [showExpand, setShowExpand] = useState(false);
  const [isExpand, setIsExpand] = useState(false);
  const [placeholder, setPlaceHolder] = useState(localize('aiNative.chat.input.placeholder.default'));

  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);
  const chatAgentService = useInjectable<IChatAgentService>(IChatAgentService);
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);

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
    textareaRef.current?.focus();
    const defaultPlaceholder = localize('aiNative.chat.input.placeholder.default');

    const findCommandHandler = chatFeatureRegistry.getSlashCommandHandler(command);
    if (findCommandHandler && findCommandHandler.providerInputPlaceholder) {
      const editor = monacoCommandRegistry.getActiveCodeEditor();
      const placeholder = findCommandHandler.providerInputPlaceholder(value, editor);
      setPlaceHolder(placeholder || defaultPlaceholder);
    } else {
      setPlaceHolder(defaultPlaceholder);
    }
  }, [chatFeatureRegistry, command]);

  useEffect(() => {
    acquireOptionsCheck(theme || '', agentId, command);
  }, [theme, agentId, command]);

  useEffect(() => {
    if (textareaRef && autoFocus) {
      textareaRef.current?.focus();
    }
  }, [textareaRef, autoFocus, props.value]);

  useEffect(() => {
    if (enableOptions) {
      if (
        (value === SLASH_SYMBOL || (value === AT_SIGN_SYMBOL && chatAgentService.getAgents().length > 0)) &&
        !isExpand
      ) {
        setIsShowOptions(true);
      } else {
        setIsShowOptions(false);
      }
    }

    if (value.startsWith(SLASH_SYMBOL)) {
      const { value: newValue, nameWithSlash } = chatFeatureRegistry.parseSlashCommand(value);

      if (nameWithSlash) {
        const commandModel = chatFeatureRegistry.getSlashCommandBySlashName(nameWithSlash);
        setValue(newValue);
        setTheme(nameWithSlash);
        if (commandModel) {
          setAgentId(commandModel.agentId!);
          setCommand(commandModel.command!);
        }
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
  }, [textareaRef, value, enableOptions, chatFeatureRegistry]);

  useEffect(() => {
    if (!value) {
      setInputHeight(defaultHeight);
      setShowExpand(false);
      setIsExpand(false);
    }
  }, [value]);

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

    const handleSendLogic = (newValue: string = value) => {
      onSend(newValue, agentId, command);
      setValue('');
      setTheme('');
      setAgentId('');
      setCommand('');
    };

    if (command) {
      const chatCommandHandler = chatFeatureRegistry.getSlashCommandHandler(command);
      if (chatCommandHandler && chatCommandHandler.execute) {
        const editor = monacoCommandRegistry.getActiveCodeEditor();
        await chatCommandHandler.execute(value, (newValue: string) => handleSendLogic(newValue), editor);
        return;
      }
    }

    handleSendLogic();
  }, [onSend, value, agentId, command, chatFeatureRegistry]);

  const acquireOptionsCheck = useCallback(
    (themeValue: string, agentId?: string, command?: string) => {
      if (agentId) {
        setIsShowOptions(false);
        setTheme('');
        setAgentId(agentId);
        setCommand(command || '');
        if (textareaRef?.current) {
          const inputValue = textareaRef.current.value;
          if (inputValue === AT_SIGN_SYMBOL || (command && inputValue === SLASH_SYMBOL)) {
            setValue('');
          }
          runWhenIdle(() => textareaRef.current!.focus());
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
          const inputValue = textareaRef.current.value;
          if (inputValue.length === 1 && inputValue.startsWith(SLASH_SYMBOL)) {
            setValue('');
          }
          runWhenIdle(() => textareaRef.current!.focus());
        }
      }
    },
    [textareaRef, chatFeatureRegistry],
  );

  const optionsBottomPosition = useMemo(() => {
    const customBottom = INSTRUCTION_BOTTOM + inputHeight;
    if (isExpand) {
      setIsShowOptions(false);
    }
    return customBottom;
  }, [inputHeight]);

  const handleKeyDown = (event) => {
    if (event.key === 'Backspace') {
      if (textareaRef.current?.selectionEnd === 0 && textareaRef.current?.selectionStart === 0) {
        setTheme('');

        if (agentId === ChatProxyService.AGENT_ID) {
          setCommand('');
          setAgentId('');
          return;
        }

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

  const handleHeightChange = useCallback((height: number) => {
    setInputHeight(height);

    if (height > EXPAND_CRITICAL_HEIGHT) {
      setShowExpand(true);
    } else {
      setShowExpand(false);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setFocus(false);
    setIsShowOptions(false);
  }, [textareaRef]);

  const handleFocus = useCallback(() => {
    setFocus(true);
  }, [textareaRef]);

  const handleExpandClick = useCallback(() => {
    const expand = isExpand;
    setIsExpand(!expand);
    if (!expand) {
      const ele = document.querySelector('#ai_chat_left_container');
      const maxHeight = ele!.clientHeight - 68 - (theme ? 32 : 0) - 16;
      setInputHeight(maxHeight);
    } else {
      setInputHeight(defaultHeight);
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
      <InteractiveInput
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onValueChange={handleInputChange}
        disabled={disabled}
        className={styles.input_wrapper}
        onSend={handleSend}
        sendBtnClassName={sendBtnClassName}
        onHeightChange={handleHeightChange}
        height={inputHeight}
        popoverPosition={PopoverPosition.left}
      />
    </div>
  );
});
