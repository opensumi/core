import cls from 'classnames';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { useInjectable, useLatest } from '@opensumi/ide-core-browser';
import { Icon, Popover, PopoverPosition, TextArea, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import {
  ChatAgentViewServiceToken,
  ChatFeatureRegistryToken,
  localize,
  runWhenIdle,
  uuid,
} from '@opensumi/ide-core-common';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { AT_SIGN_SYMBOL, IChatAgentService, SLASH_SYMBOL } from '../../common';
import { ChatAgentViewService } from '../chat/chat-agent.view.service';
import { ChatSlashCommandItemModel } from '../chat/chat-model';
import { ChatProxyService } from '../chat/chat-proxy.service';
import { ChatFeatureRegistry } from '../chat/chat.feature.registry';
import { IChatSlashCommandItem } from '../types';

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
  } = props;
  const agentId = propsAgentId || defaultAgentId;
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

  const renderAddonAfter = useMemo(
    () => (
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
              content={localize('aiNative.chat.enter.send')}
              position={PopoverPosition.left}
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
    ),
    [focus, disabled, props.sendBtnClassName, handleSend],
  );

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
        addonAfter={renderAddonAfter}
      />
    </div>
  );
});
