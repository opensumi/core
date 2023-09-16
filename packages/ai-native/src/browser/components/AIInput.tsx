import React, { useCallback, useState } from 'react';

import { getIcon } from '@opensumi/ide-core-browser';
import { Icon, Input } from '@opensumi/ide-core-browser/lib/components/index';

export const AiInput = ({ onValueChange }) => {
  const [value, setValue] = useState<string>();

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  const emitterValueChange = useCallback(() => {
    if (onValueChange) {
      onValueChange(value);
    }
  }, [value]);

  return (
    <Input
      className={'ai_native_input_container'}
      placeholder={'可以问我任何问题，或键入主题 "/"'}
      value={value}
      onValueChange={handleChange}
      addonAfter={
        <Icon className={getIcon('right')} onClick={() => emitterValueChange()} />
      }
    />
  );
};
