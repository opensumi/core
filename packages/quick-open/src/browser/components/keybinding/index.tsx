import clx from 'classnames';
import React from 'react';

import { Keybinding, KeybindingRegistry, useInjectable } from '@opensumi/ide-core-browser';

import styles from './styles.module.less';

export const KeybindingView: React.FC<{
  keybinding: Keybinding;
  className?: string;
  sequenceClassName?: string;
  keyClassName?: string;
}> = ({ keybinding, className, sequenceClassName, keyClassName }) => {
  const keybindingRegistry: KeybindingRegistry = useInjectable(KeybindingRegistry);
  const keyMaps = React.useMemo(() => keybindingRegistry.acceleratorFor(keybinding, ' '), [keybinding]);
  return (
    <div className={clx(styles.keybinding, className)}>
      {keyMaps
        ? keyMaps.map((value, i) => {
            const keys = value.split(' ');
            return (
              <div key={`${value}_${i}`} title={value} className={clx(styles.key_sequence, sequenceClassName)}>
                {keys.map((key, j) => (
                  <span className={clx(styles.key, keyClassName)} key={`${key}_${i}_${j}`}>
                    {key}
                  </span>
                ))}
              </div>
            );
          })
        : null}
    </div>
  );
};
