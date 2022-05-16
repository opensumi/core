import { observer } from 'mobx-react-lite';
import React, { useRef, useEffect, useState, useCallback } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Scroll } from '@opensumi/ide-core-browser/lib/components/scroll';
import { IThemeService, ThemeType } from '@opensumi/ide-theme';

import { ITerminalGroupViewService, ITerminalRenderProvider, ItemType } from '../../common';
import { TerminalContextMenuService } from '../terminal.context-menu';

import TabItem from './tab.item';
import styles from './tab.module.less';

export default observer(() => {
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const provider = useInjectable<ITerminalRenderProvider>(ITerminalRenderProvider);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const tabContainer = useRef<HTMLDivElement | null>();
  const [theme, setTheme] = useState<ThemeType>('dark');

  const init = useCallback(() => {
    themeService.getCurrentTheme().then((theme) => {
      setTheme(theme.type);
    });
    return themeService.onThemeChange((theme) => {
      setTheme(theme.type);
    });
  }, [theme, themeService]);

  useEffect(() => {
    const disposable = init();
    return () => {
      disposable.dispose();
    };
  }, []);
  return (
    <div className={styles.view_container}>
      <div className={styles.tabs}>
        <Scroll ref={(el) => (el ? (tabContainer.current = el.ref) : null)}>
          <div className={styles.tab_contents}>
            {view.groups.map((group, index) => {
              if (!group) {
                return;
              }
              return (
                <TabItem
                  key={group.id}
                  id={group.id}
                  options={group.options}
                  editable={group.editable}
                  name={group.snapshot}
                  selected={view.currentGroup && view.currentGroup.id === group.id}
                  onInputBlur={() => group.unedit()}
                  onInputEnter={(_: string, name: string) => group.rename(name)}
                  onClick={() => view.selectGroup(index)}
                  onClose={() => view.removeGroup(index)}
                  onContextMenu={(event) => menuService.onTabContextMenu(event, index)}
                  provider={provider}
                  theme={theme}
                ></TabItem>
              );
            })}
            <div className={styles.button}>
              <TabItem
                type={ItemType.add}
                onClick={() => {
                  const index = view.createGroup();
                  const group = view.getGroup(index);
                  view.createWidget(group);
                  view.selectGroup(index);
                }}
                onDropdown={(event) => menuService.onDropDownContextMenu(event)}
                provider={provider}
                theme={theme}
              />
            </div>
          </div>
        </Scroll>
      </div>
    </div>
  );
});
