/* istanbul ignore file */
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { Domain, URI, CommandContribution, CommandRegistry } from '@ali/ide-core-browser';
import { isElectronRenderer, localize } from '@ali/ide-core-common';
import { ResourceService, IResource } from '@ali/ide-editor';
import { EDITOR_WEBVIEW_SCHEME, IWebviewService, IEditorWebviewMetaData } from './types';
import { Autowired } from '@ali/common-di';
import { WebviewServiceImpl } from './webview.service';

const WEBVIEW_DEVTOOLS_COMMAND = {
  id: 'workbench.action.webview.openDeveloperTools',
  label: localize('openToolsLabel', 'Open Webview Developer Tools'),
};

@Domain(BrowserEditorContribution, CommandContribution)
export class WebviewModuleContribution implements BrowserEditorContribution, CommandContribution {

  @Autowired(IWebviewService)
  webviewService: WebviewServiceImpl;

  @Autowired(EditorComponentRegistry)
  editorComponentRegistry: EditorComponentRegistry;

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider({
      scheme: EDITOR_WEBVIEW_SCHEME,
      provideResource: async (uri: URI): Promise<IResource<IEditorWebviewMetaData>> => {
        const existingComponent = this.webviewService.editorWebviewComponents.get(uri.path.toString());
        if (existingComponent) {
          return existingComponent.resource;
        } else {
          // try revive, 如果无法恢复，会抛错
          await this.webviewService.tryRestoredWebviewComponent(uri.path.toString());
          return this.webviewService.editorWebviewComponents.get(uri.path.toString())!.resource;
        }
      },
      shouldCloseResource: (resource: IResource<IEditorWebviewMetaData>, openedResources: IResource[][]) => {
        let count = 0;
        for (const resources of openedResources) {
          for (const r of resources) {
            if (r.uri.scheme === EDITOR_WEBVIEW_SCHEME && r.uri.toString() === resource.uri.toString()) {
              count ++;
            }
            if (count > 1) {
              return true;
            }
          }
        }
        this.webviewService.editorWebviewComponents.get(resource.uri.path.toString())!.clear();
        return true;
      },
    });
  }

  registerCommands(commandRegistry: CommandRegistry) {
    commandRegistry.registerCommand(WEBVIEW_DEVTOOLS_COMMAND, {
      execute: () => {
        const elements = document.querySelectorAll<Electron.WebviewTag>('webview');
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < elements.length; i += 1) {
          try {
            elements[i].openDevTools();
          } catch (e) {
            // noop
          }
        }
      },
      isEnabled: () => {
        return isElectronRenderer();
      },
    });
  }
}
