import * as React from 'react';
import * as styles from './index.module.less';
import { Input } from '@ali/ide-core-browser/lib/components';

export interface ExtensionSearchProps {
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

export const ExtensionSearch: React.FC<ExtensionSearchProps> = ({ onChange, onSearch, placeholder }) => {

  const [ query, setQuery ] = React.useState('');

  function handleChange(value: string) {
    onChange(value);
    setQuery(value);
  }

  const handleKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === 13) {
      if (onSearch) {
        onSearch(query);
      }
    }
  }, [ query ]);

  return (
    <div className={styles.input}>
      <Input
        placeholder={placeholder}
        autoFocus={true}
        value={query}
        onKeyPress={handleKeyPress}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
};
