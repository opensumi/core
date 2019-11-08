import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalController } from '../common';

export default observer(() => {

  const controller = useInjectable<ITerminalController>(ITerminalController);

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const index = event.target.value;
    controller.selectIndex(parseInt(index, 10));
  };

  return (
    <div>
      <select value={ controller.state.index } onChange={ onChange }>
        {
          controller.groups.map((group, index) => {
            return <option key={ `${group}-${index}` } value={ index }>{ `${index + 1}: ${group.snapshot()}` }</option>;
          })
        }
      </select>
    </div>
  );
});
