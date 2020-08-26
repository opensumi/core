import { Autowired } from '@ali/common-di';
import { ComponentContribution, ComponentRegistry, getIcon, localize, Logger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { IMainLayoutService } from '@ali/ide-main-layout';

import { DEBUG_CONSOLE_CONTAINER_ID } from '../../../common';
import { DebugConsoleView } from './debug-console.view';
import { DebugConsoleInputDocumentProvider } from './debug-console.service';
import { BrowserEditorContribution, IEditorDocumentModelContentRegistry } from '@ali/ide-editor/lib/browser';

export const DEBUG_CONSOLE_VIEW_ID = 'debug-console-view';

@Domain(ComponentContribution, BrowserEditorContribution)
export class DebugConsoleContribution implements ComponentContribution, BrowserEditorContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(DebugConsoleInputDocumentProvider)
  private debugConsoleInputDocumentProvider: DebugConsoleInputDocumentProvider;

  registerComponent(registry: ComponentRegistry) {
    registry.register('debug-console', {
      id: DEBUG_CONSOLE_VIEW_ID,
      component: DebugConsoleView,
    }, {
      title: localize('debug.console.panel.title'),
      priority: 8,
      containerId: DEBUG_CONSOLE_CONTAINER_ID,
      iconClass: getIcon('debug'),
    });
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.debugConsoleInputDocumentProvider);
  }
}
