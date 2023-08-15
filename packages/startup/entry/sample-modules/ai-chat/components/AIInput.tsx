import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Select } from 'antd';
import React, { CSSProperties, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

const { Option } = Select;

export const AiInput = ({ onValueChange }) => {
  const [data, setData] = useState<any>([]);
  const [value, setValue] = useState<string>();

  const createItem = useCallback(
    (iconName: string, value: string) => ({
      iconName,
      value,
    }),
    [],
  );

  const handleSearch = (newValue: string) => {
    if (newValue === '/') {
      setData([
        createItem('file-binary', '给出测试用例'),
        createItem('edit', '优化一下代码'),
        createItem('info', '为代码添加注释'),
        createItem('tools', '补全代码中缺失的部分'),
        createItem('code', '检查下代码是否有问题'),
        createItem('wand', '按照我的想法修改代码，具体的想法是...'),
        createItem('code', '用别的语言写这段代码，比如...'),
      ]);
    } else {
      setData([]);
    }
  };

  const handleChange = (newValue: string) => {
    console.log('select handleChange:>>> ', newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
    setValue(newValue);
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder={'输入 /，针对选中代码，唤醒 AI 任务'}
      style={{ width: 460 }}
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false}
      onSearch={handleSearch}
      size={'middle'}
      onChange={handleChange}
      suffixIcon={<span className={getExternalIcon('send')}></span>}
      notFoundContent={null}
    >
      {data.map(({ iconName, value }, i) => (
        <Option key={i} value={value}>
          <div style={{display: 'flex', alignItems: 'center'}}>
            <span style={{marginRight: 6}} className={getExternalIcon(iconName)}></span>
            <span>{value}</span>
          </div>
        </Option>
      ))}
    </Select>
  );
};