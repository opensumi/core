import * as React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import { localize } from '@ali/ide-core-browser';
import { ISCMRepository } from '../../../common';

import * as styles from './styles.module.less';

export const SCMInput: React.FC<{
  repository: ISCMRepository;
  value: string;
  onChange: (value: string) => void;
}> = ({ repository, value, onChange }) => {
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const msg = e.target.value;
    onChange(msg);
    // 上层只有存在 repository 时才会渲染 Header 部分
    repository.input.value = msg;
  }

  return (
    <div className={styles.scmInput}>
      <TextareaAutosize
        placeholder={localize('commit msg', 'Message (press ⌘Enter to commit)')}
        autoFocus={true}
        tabIndex={1}
        value={value}
        onChange={handleChange}
        rows={1}
        maxRows={6} /* from VS Code */
      />
    </div>
  );
};
