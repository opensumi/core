import * as React from 'react';
import { Keybinding, KeybindingRegistry, useInjectable } from '@ali/ide-core-browser';
import * as styles from './styles.module.less';

export const KeybindingView: React.FC<{
  keybinding: Keybinding;
}> = ({ keybinding }) => {
  const keybindingRegistry: KeybindingRegistry = useInjectable(KeybindingRegistry);
  const keyMaps = React.useMemo(() => {
    return keybindingRegistry.acceleratorFor(keybinding, ' ');
  }, [ keybinding ]);
  return (
    <div className={styles.keybinding}>
      {
        keyMaps ? keyMaps.map((value, i) => {
          const keys = value.split(' ');
          return (
            <div key={`${value}_${i}`} title={value} className={styles.key_sequence}>
              {
                keys.map((key, j) => (<span className={styles.key} key={`${key}_${i}_${j}`}>{key}</span>))
              }
            </div>
          );
        }) : null
      }
    </div>
  );
};
