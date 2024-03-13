import { Autowired } from '@opensumi/di';
import { CommandContribution, CommandRegistry, Domain } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';

import { IWebviewService } from './types';
import { WebviewServiceImpl } from './webview.service';

const WEBVIEW_DEVTOOLS_COMMAND = {
  id: 'workbench.action.webview.openDeveloperTools',
  label: localize('openToolsLabel', 'Open Webview Developer Tools'),
};

@Domain(CommandContribution)
export class ElectronWebviewModuleContribution implements CommandContribution {
  @Autowired(IWebviewService)
  webviewService: WebviewServiceImpl;

  registerCommands(commandRegistry: CommandRegistry) {
    commandRegistry.registerCommand(WEBVIEW_DEVTOOLS_COMMAND, {
      execute: () => {
        const elements = document.querySelectorAll<Electron.WebviewTag>('webview');
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < elements.length; i += 1) {
          try {
            elements[i].openDevTools();
          } catch (e) {
            // noop
          }
        }
      },
    });
  }
}
