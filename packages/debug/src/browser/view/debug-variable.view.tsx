import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugVariableService } from './debug-variable.service';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-variable.module.less';

export const DebugVariableView = observer(() => {
  const {
    scopes,
  }: DebugVariableService = useInjectable(DebugVariableService);
  return <div className={styles.debug_variables}>
    {
      scopes && scopes.map((scope) => {
        return <div className={styles.debug_variables_item}>
          <div className={styles.debug_variables_item_label}>
            { scope.name }
          </div>
          <div className={styles.debug_variables_item_description}>
            ref: { scope.variablesReference }
          </div>
        </div>;
      })
    }
  </div>;
});
