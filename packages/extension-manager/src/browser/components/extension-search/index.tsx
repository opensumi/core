import * as React from 'react';
import * as styles from './index.module.less';
import { Input } from '@ali/ide-core-browser/lib/components';

export interface ExtensionSearchProps {
  query: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const ExtensionSearch: React.FC<ExtensionSearchProps> = ({ query, onChange, placeholder }, ref) => {

  return (
    <div className={styles.input}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
