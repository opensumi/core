import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { IToolbarActionGroup } from '@ali/ide-core-browser/lib/menu/next';
import { Button, Select, Option, Tooltip } from '@ali/ide-components';

import { IToolbarActionStore } from './toolbar-action.store';
import * as styles from './toolbar-action.module.less';

const ActionGroup = observer(({ group, id }: { group: IToolbarActionGroup; id: string }) => {
  return (<div className={styles.actionGroup} key={id}>
    {group.map((action) => {
      switch (action.type) {
        case 'action':
          return (
            <Tooltip title={action.title}>
              <Button key={`${id}-${action.title}`} onClick={action.click} className={styles.action} type='icon' iconClass={action.iconClass} />
            </Tooltip>);
        case 'enum':
          return (<Select
            key={`${id}-${action.title}`}
            onChange={action.select}
            className={styles.action}
            size='small'
            style={{ width: 110 }}
            value={action.defaultValue || action.title}
            options={action.enum.map((option) => <Option key={option} label={option} value={option}>{option}</Option>)}
            />);
        default:
          console.warn(`Unknow Action type called: ${id}`);
      }
  })}
  </div>);
});

export const ToolbarAction = observer(() => {
  const actionToolbarService = useInjectable<IToolbarActionStore>(IToolbarActionStore);
  const groups = actionToolbarService.toolbarActionGroups;
  return (
    <div className={styles.toolbarActions}>
      {
        Array.from(actionToolbarService.toolbarActionGroups.keys()).map((key, idx) => <ActionGroup id={key} key={key} group={groups.get(key)!} />)
      }
    </div>
  );
});
