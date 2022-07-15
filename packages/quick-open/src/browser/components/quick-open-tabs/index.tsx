import clx from 'classnames';
import React from 'react';

import { KeybindingRegistry, useInjectable, localize, QuickOpenTab } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';

import { KeybindingView } from '../keybinding';

import styles from './style.module.less';

interface Props {
  tabs: QuickOpenTab[];
  activePrefix: string;
  onChange: (activePrefix: string) => void;
  toggleTab?: () => void;
}

export const QuickOpenTabs: React.FC<Props> = ({ tabs, activePrefix, onChange, toggleTab }) => {
  const keybindingRegistry = useInjectable<KeybindingRegistry>(KeybindingRegistry);
  const getKeybinding = (commandId: string) => {
    const bindings = keybindingRegistry.getKeybindingsForCommand(commandId);
    return bindings ? bindings[0] : undefined;
  };

  return (
    <div id={VIEW_CONTAINERS.QUICKPICK_TABS} className={styles.quickopen_tabs}>
      <div className={styles.quickopen_tabs_left}>
        {tabs.map(({ title, prefix, commandId, order }, i) => {
          const keybinding = getKeybinding(commandId);
          return (
            <div
              key={prefix}
              className={styles.quickopen_tabs_left_item}
              onMouseDown={(e) => e.preventDefault()} // 使 input 不失去 focus
              onClick={() => {
                if (prefix !== activePrefix) {
                  onChange(prefix);
                }
              }}
            >
              <div
                className={clx(styles.quickopen_tabs_left_item_text, { [styles.selected]: activePrefix === prefix })}
              >
                {title}
              </div>
              {keybinding && (
                <KeybindingView keybinding={keybinding} className={styles.keybinding} keyClassName={styles.tab_key} />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          flex: 1,
        }}
      ></div>
      <div
        className={styles.quickopen_tabs_tip}
        onClick={() => {
          toggleTab?.();
        }}
      >
        {localize('quickopen.tab.tip.prefix')}
        <span className={styles.tab_key}>Tab</span>
        {localize('quickopen.tab.tip.suffix')}
      </div>
    </div>
  );
};
