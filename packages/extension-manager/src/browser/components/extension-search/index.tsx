import React from 'react';
import styles from './index.module.less';
import { AutoFocusedInput } from '@ali/ide-main-layout/lib/browser/input';
import { enableExtensionsContainerId } from '../../../common';

export interface ExtensionSearchProps {
  query: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const ExtensionSearch: React.FC<ExtensionSearchProps> = ({ query, onChange, placeholder }, ref) => {

  return (
    <div className={styles.input}>
      <AutoFocusedInput
        containerId={enableExtensionsContainerId}
        placeholder={placeholder}
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
