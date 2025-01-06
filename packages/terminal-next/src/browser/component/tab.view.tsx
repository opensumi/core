import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Scrollbars } from '@opensumi/ide-components';
import { KeybindingRegistry, useAutorun, useDesignStyles, useInjectable } from '@opensumi/ide-core-browser';
import { IThemeService, ThemeType } from '@opensumi/ide-theme';

import { ITerminalGroupViewService, ITerminalRenderProvider, ItemType } from '../../common';
import { TerminalContextMenuService } from '../terminal.context-menu';

import TabItem from './tab.item';
import styles from './tab.module.less';

export default () => {
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const provider = useInjectable<ITerminalRenderProvider>(ITerminalRenderProvider);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const keybindingService = useInjectable<KeybindingRegistry>(KeybindingRegistry);
  const tabContainer = useRef<HTMLDivElement | null>();
  const [theme, setTheme] = useState<ThemeType>('dark');
  const styles_tab_contents = useDesignStyles(styles.tab_contents, 'tab_contents');

  const groups = useAutorun(view.groups);
  const currentGroup = useAutorun(view.currentGroup);

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
        <Scrollbars forwardedRef={(el) => (el ? (tabContainer.current = el.ref) : null)}>
          <div className={styles_tab_contents}>
            {groups.filter(Boolean).map((group, index) => (
              <TabItem
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('groupIndex', String(index));
                }}
                onDrop={(e: React.DragEvent) => {
                  e.preventDefault();
                  if (e.dataTransfer.getData('groupIndex')) {
                    const i = e.dataTransfer.getData('groupIndex');
                    view.swapGroup(Number(i), index);
                    view.selectGroup(index);
                  }
                }}
                key={group.id}
                group={group}
                selected={currentGroup && currentGroup.id === group.id}
                onInputBlur={() => group.unedit()}
                onInputEnter={(_: string, name: string) => group.rename(name)}
                onClick={() => view.selectGroup(index)}
                onClose={() => view.removeGroup(index)}
                onContextMenu={(event) => menuService.onTabContextMenu(event, index)}
                provider={provider}
                theme={theme}
              ></TabItem>
            ))}
            <div className={styles.button}>
              <TabItem
                type={ItemType.add}
                onClick={() => {
                  const index = view.createGroup();
                  const group = view.getGroup(index);
                  view.createWidget(group);
                  view.selectGroup(index);
                }}
                getKeybinding={(id) => {
                  const bindings = keybindingService.getKeybindingsForCommand(id);
                  if (Array.isArray(bindings) && bindings[0]) {
                    return keybindingService.acceleratorFor(bindings[0], '')[0] || '';
                  }
                  return '';
                }}
                onDropdown={(event) => menuService.onDropDownContextMenu(event)}
                provider={provider}
                theme={theme}
              />
            </div>
          </div>
        </Scrollbars>
      </div>
    </div>
  );
};
