import classnames from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { ToolbarLocation } from '@opensumi/ide-core-browser';

import styles from './toolbar-action.module.less';


// const ActionGroup = observer(({ group, id }: { group: IToolbarActionGroup; id: string }) => {
//   return (<div className={styles.actionGroup} key={id}>
//     {group.map((action) => {
//       switch (action.type) {
//         case 'action':
//           return (
//             <Tooltip title={action.title}>
//               <Button key={`${id}-${action.title}`} onClick={action.click} className={styles.action} type='icon' iconClass={action.iconClass} />
//             </Tooltip>);
//         case 'enum':
//           return (<Select
//             key={`${id}-${action.title}`}
//             onChange={action.select}
//             className={styles.action}
//             size='small'
//             style={{ width: 110 }}
//             value={action.defaultValue || action.title}
//             options={action.enum.map((option) => <Option key={option} label={option} value={option}>{option}</Option>)}
//             />);
//         default:
//           console.warn(`Unknow Action type called: ${id}`);
//       }
//   })}
//   </div>);
// });

export const ToolbarAction = observer(() => (
  <div className={styles.toolbarActionsWrapper}>
    <ToolbarLocation
      location='menu-left'
      preferences={{ noDropDown: true }}
      className={classnames(styles.toolbarActions, styles.toolbarActionsLeft)}
    />
    <ToolbarLocation location='menu-right' className={classnames(styles.toolbarActions, styles.toolbarActionsRight)} />
  </div>
));
