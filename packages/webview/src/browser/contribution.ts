import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { Domain, URI } from '@ali/ide-core-browser';
import { ResourceService, IResource } from '@ali/ide-editor';
import { EDITOR_WEBVIEW_SCHEME, IWebviewService, IWebview, IPlainWebview, IEditorWebviewMetaData } from './types';
import { Autowired } from '@ali/common-di';
import { WebviewServiceImpl } from './webview.service';

@Domain(BrowserEditorContribution)
export class WebviewModuleContribution implements BrowserEditorContribution {

  @Autowired(IWebviewService)
  webviewService: WebviewServiceImpl;

  @Autowired(EditorComponentRegistry)
  editorComponentRegistry: EditorComponentRegistry;

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider({
      scheme: EDITOR_WEBVIEW_SCHEME,
      provideResource: (uri: URI): IResource<IEditorWebviewMetaData> => {
        return this.webviewService.editorWebviewComponents.get(uri.path.toString())!.resource;
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

}
