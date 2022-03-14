import React from 'react';
import { useMemo, useState } from 'react';

import {
  Domain,
  ComponentContribution,
  ComponentRegistry,
  EDITOR_COMMANDS,
  SEARCH_COMMANDS,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { KeybindingRegistry } from '@opensumi/ide-core-browser/lib/keybinding/keybinding';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { Disposable, localize, registerLocalizationBundle } from '@opensumi/ide-core-common';
import { ThrottledDelayer } from '@opensumi/ide-core-common/lib/async';
import { IKeymapService } from '@opensumi/ide-keymaps/lib/common/keymaps';
import { KeybindingView } from '@opensumi/ide-quick-open/lib/browser/components/keybinding';
import { QUICK_OPEN_COMMANDS } from '@opensumi/ide-quick-open/lib/common';

import styles from './editor-empty-component.module.less';

const DEFAULT_CHANGE_DELAY = 500; // ms

// 集成侧自定义多语言
export const localizationBundle = {
  'zh-CN': {
    languageId: 'zh-CN',
    languageName: 'Chinese',
    localizedLanguageName: '中文(中国)',
    contents: {
      'custom.quick_open': '转到文件',
      'custom.command_palette': '显示所有命令',
      'custom.terminal_panel': '切换终端',
      'custom.search_panel': '切换搜索面板',
    },
  },
  'en-US': {
    languageId: 'en-US',
    languageName: 'English',
    localizedLanguageName: 'English',
    contents: {
      'custom.quick_open': 'Quick Open',
      'custom.command_palette': 'Command Palette',
      'custom.terminal_panel': 'Toggle Terminal Panel',
      'custom.search_panel': 'Toggle Search Panel',
    },
  },
};
registerLocalizationBundle(localizationBundle['zh-CN']);
registerLocalizationBundle(localizationBundle['en-US']);

/**
 * 单行快捷键信息
 * @param param0
 * @returns
 */
const ShortcutRow = ({ label, keybinding }) => (
  <dl className={styles.shortcutRow}>
    <span className={styles.label}>{label}</span>
    <KeybindingView keybinding={keybinding} className={styles.keybinding} />
  </dl>
);

/**
 * 编辑器空白页引导信息
 */
export const EditorEmptyComponent = () => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [keyMapLoaded, setKeyMapLoaded] = useState(false);

  const keybindingRegistry = useInjectable<KeybindingRegistry>(KeybindingRegistry);
  const keymapService = useInjectable<IKeymapService>(IKeymapService);
  const appConfig = useInjectable<AppConfig>(AppConfig);

  const getKeybinding = (commandId: string) => {
    const bindings = keybindingRegistry.getKeybindingsForCommand(commandId);
    if (!bindings.length) {
      return;
    }

    const keyBindings = bindings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    // 如果快捷键条目没有 when 条件，优先使用
    const primaryKeybinding = bindings.find((binding) => !binding.when);
    return primaryKeybinding || keyBindings[0];
  };

  const init = async () => {
    await keymapService.whenReady;
    setKeyMapLoaded(true);
  };

  React.useEffect(() => {
    init();
  }, []);

  const ShortcutView = useMemo(() => {
    if (!imgLoaded || !keyMapLoaded) {
      return;
    }

    const keyInfos = [
      {
        label: localize('custom.quick_open'),
        command: EDITOR_COMMANDS.QUICK_OPEN.id,
        keybinding: getKeybinding(EDITOR_COMMANDS.QUICK_OPEN.id),
      },
      {
        label: localize('custom.command_palette'),
        command: QUICK_OPEN_COMMANDS.OPEN.id,
        keybinding: getKeybinding(QUICK_OPEN_COMMANDS.OPEN.id),
      },
      {
        label: localize('custom.terminal_panel'),
        command: 'workbench.view.terminal',
        keybinding: getKeybinding('workbench.view.terminal'),
      },
      {
        label: localize('custom.search_panel'),
        command: SEARCH_COMMANDS.OPEN_SEARCH.id,
        keybinding: getKeybinding(SEARCH_COMMANDS.OPEN_SEARCH.id),
      },
    ].filter((e) => e.keybinding);

    return (
      <div className={styles.shortcutPanel}>
        {keyInfos.map((keyInfo) => (
          <ShortcutRow key={keyInfo.command} label={keyInfo.label} keybinding={keyInfo.keybinding}></ShortcutRow>
        ))}
      </div>
    );
  }, [imgLoaded, keyMapLoaded]);

  return (
    <div className={styles.empty_component}>
      <img src={appConfig.editorBackgroundImage} onLoad={() => setImgLoaded(true)} />
      {ShortcutView}
    </div>
  );
};

@Domain(ComponentContribution)
export class EditorEmptyComponentContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('editor-empty', {
      id: 'editor-empty',
      component: EditorEmptyComponent,
      initialProps: {},
    });
  }
}
