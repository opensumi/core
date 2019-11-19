import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController } from '../common';

import * as styles from './terminal.module.less';

export default observer(() => {

  const controller = useInjectable<ITerminalController>(ITerminalController);

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const index = event.target.value;
    controller.selectGroup(parseInt(index, 10));
  };

  const index = controller.state && controller.state.index;

  return (
    <div className={styles.toolbarSelect}>
      <select value={ index || 0 } onChange={ onChange }>
        {
          (controller.groups || []).map((group, index) => {
            return <option key={ `${group}-${index}` } value={ index }>{ `${index + 1}: ${controller.snapshot()}` }</option>;
          })
        }
      </select>
    </div>
  );
});
