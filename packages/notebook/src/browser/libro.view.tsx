import { DocumentCommands, LibroView } from '@difizen/libro-jupyter/noeditor';
import { CommandRegistry, Container, Disposable, ViewRender } from '@difizen/mana-app';
import debounce from 'lodash/debounce';
import * as React from 'react';

import { message } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser/types';

import { LibroStateManager } from './libro-state-manager';
import styles from './libro.module.less';
import { ILibroOpensumiService } from './libro.service';
import { ManaContainer } from './mana';

const AUTO_SAVE_DELAY = 1000; // ms

export const OpensumiLibroView: ReactEditorComponent = (...params) => {
  const libroOpensumiService = useInjectable<ILibroOpensumiService>(ILibroOpensumiService);
  const manaContainer = useInjectable<Container>(ManaContainer);
  const commandRegistry = manaContainer.get(CommandRegistry);
  const stateManager = useInjectable<LibroStateManager>(LibroStateManager);

  const [libroView, setLibroView] = React.useState<LibroView | undefined>(undefined);
  const [isStateRestored, setIsStateRestored] = React.useState(false);
  const uri = params[0].resource.uri;

  // 保存状态的函数
  const saveNotebookState = React.useCallback(() => {
    if (libroView && uri) {
      stateManager.saveState(uri, libroView);
    }
  }, [libroView, uri, stateManager]);

  // 恢复状态的函数
  const restoreNotebookState = React.useCallback(async () => {
    if (libroView && uri && !isStateRestored) {
      const restored = await stateManager.restoreState(uri, libroView);
      if (restored) {
        setIsStateRestored(true);
      }
    }
  }, [libroView, uri, stateManager, isStateRestored]);

  React.useEffect(() => {
    let autoSaveHandle: undefined | number;
    let modelChangeDisposer: undefined | Disposable;

    // 监听滚动变化（防抖）
    const handleScroll = debounce(() => {
      saveNotebookState();
    }, 500);

    libroOpensumiService.getOrCreateLibroView(uri).then((libro) => {
      setLibroView(libro);

      // 恢复状态
      restoreNotebookState();

      // 监听模型变化
      modelChangeDisposer = libro.model.onChanged(() => {
        libroOpensumiService.updateDirtyStatus(uri, true);
        if (autoSaveHandle) {
          window.clearTimeout(autoSaveHandle);
        }
        autoSaveHandle = window.setTimeout(() => {
          commandRegistry
            .executeCommand(DocumentCommands.Save.id, undefined, libro, undefined, { reason: 'autoSave' })
            .then(() => {
              if (libro) {
                libro.model.dirty = false;
              }
            })
            .catch((error) => {
              message.error(localize('doc.saveError.failed'), error);
            });
        }, AUTO_SAVE_DELAY);
      });

      libro.onSave(() => {
        libroOpensumiService.updateDirtyStatus(uri, false);
      });

      const libroViewContainer = libro.container?.current;

      if (libroViewContainer) {
        const libroViewContent = libroViewContainer.querySelector(LibroStateManager.LIBRO_SCROLL_ELEMENT);
        libroViewContent?.addEventListener('scroll', handleScroll);
      }
    });

    return () => {
      modelChangeDisposer?.dispose();
      window.clearTimeout(autoSaveHandle);
      libroView?.container?.current
        ?.querySelector(LibroStateManager.LIBRO_SCROLL_ELEMENT)
        ?.removeEventListener('scroll', handleScroll);
    };
  }, [libroOpensumiService, uri, commandRegistry, stateManager, saveNotebookState, restoreNotebookState]);

  // 当 notebook 完全加载后恢复状态
  React.useEffect(() => {
    if (libroView && !isStateRestored) {
      const timer = setTimeout(() => {
        restoreNotebookState();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [libroView, isStateRestored, restoreNotebookState]);

  return <div className={styles.libroView}>{libroView && <ViewRender view={libroView}></ViewRender>}</div>;
};
