import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { ITerminalGroupViewService } from '../../common';

import styles from './terminal.module.less';

export default observer(() => {
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const index = event.target.value;
    view.selectGroup(parseInt(index, 10));
  };

  const index = view.currentGroupIndex;

  return (
    <div className={styles.toolbarSelect}>
      <select value={index || 0} onChange={onChange}>
        {(view.groups || []).map((group, index) => (
          <option key={`${group}-${index}`} value={index}>{`${index + 1}: ${group.snapshot}`}</option>
        ))}
      </select>
    </div>
  );
});
