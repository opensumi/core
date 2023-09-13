import cls from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Icon, Input, getIcon } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';


interface IBlockProps {
  icon: string;
  name?: string;
}

const Block = ({ icon, name }: IBlockProps) => (
  <div className={styles.block}>
    <Icon className={icon} />
    {name && <span className={styles.name}>{name}</span>}
  </div>
);
// 指令命令激活组件
const InstructionOptions = () => {
  const [commonlyUsed, setCommonlyUsed] = useState<IBlockProps[]>([]);
  const [options, setOptions] = useState<IBlockProps[]>([]);

  useEffect(() => {
    setOptions([
      {
        icon: getIcon('delete'),
        name: '聊天',
      },
    ]);

    setCommonlyUsed([
      {
        icon: getIcon('delete'),
        name: '聊天',
      },
    ]);
  }, []);

  return (
    <div className={styles.instruction_options_container}>
      <div className={styles.options}>
        <ul>
          {options.map(({ icon, name }) => (
            <li>
              <Block icon={icon} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      </div>
      {commonlyUsed.length > 0 && (
        <div className={styles.commonly_used}>
          <span>常用指令：</span>
          {commonlyUsed.map(({ icon, name }) => (
            <Block icon={icon} name={name} />
          ))}
        </div>
      )}
    </div>
  );
};

export interface IChatInputProps {
  onSend: (value: string) => void;
}

// 指令命令激活组件
export const ChatInput = ({ onSend }: IChatInputProps) => {
  const [value, setValue] = useState('');
  const [isShowOptions, setIsShowOptions] = useState<boolean>(false);
  const [wrapperHeight, setWrapperHeight] = useState<number>(40);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = useCallback(
    (value: string) => {
      setValue(value);

      if (value.startsWith('/')) {
        setIsShowOptions(true);
      } else {
        setIsShowOptions(false);
      }

      if (inputRef && inputRef.current) {
        // 自适应高度
        const lineCount = value.split('\n').length;
        setWrapperHeight(16 * (lineCount + 1) + 8);
      }
    },
    [inputRef],
  );

  const handleSend = useCallback(() => {
    if (onSend) {
      onSend(value);
      setValue('');
    }
  }, [onSend, value]);

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && <InstructionOptions />}
      <div className={styles.header_operate}>
        <Block icon={getIcon('add-comments')} name={'新对话'} />
        <Icon className={getExternalIcon('history')} />
      </div>
      <Input
        ref={inputRef}
        placeholder={'可以问我任何问题，或键入主题 "/"'}
        wrapperStyle={{ height: wrapperHeight + 'px' }}
        value={value}
        type={'textarea'}
        onValueChange={handleInputChange}
        className={styles.input_wrapper}
        // onPressEnter={() => handleSend()}
        addonAfter={
          <div className={cls(styles.send_chat_btn, value.length && styles.active)} onClick={() => handleSend()}>
            <Icon className={getIcon('right')} />
          </div>
        }
      />
    </div>
  );
};
