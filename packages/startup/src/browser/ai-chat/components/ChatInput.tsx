import React, { useCallback, useEffect, useState } from 'react';

import { Icon, Input, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import * as styles from './components.module.less';

interface IBlockProps {
  icon: string;
  name?: string;
}

const Block = ({ icon, name }: IBlockProps) => (
  <div className={styles.block}>
    <Icon className={icon} />
    {name && <span className={styles.name}>name</span>}
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

  const handleInputChange = useCallback((value: string) => {
    setValue(value);

    if (value.startsWith('/')) {
      setIsShowOptions(true);
    } else {
      setIsShowOptions(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    if (onSend) {
      onSend(value);
      setValue('');
    }
  }, [onSend, value]);

  return (
    <div className={styles.chat_input_container}>
      {isShowOptions && <InstructionOptions />}
      <Input
        placeholder={'可以问我任何问题，或键入主题 "/"'}
        value={value}
        onValueChange={handleInputChange}
        className={styles.input_wrapper}
        onPressEnter={() => handleSend()}
        addonAfter={
          <div className={styles.send_chat_btn} onClick={() => handleSend()}>
            <Icon className={getIcon('right')} />
          </div>
        }
      />
    </div>
  );
};
