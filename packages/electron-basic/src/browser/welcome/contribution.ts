import { Domain, URI, localize, ClientAppContribution } from '@ali/ide-core-browser';
import { BrowserEditorContribution, EditorComponentRegistry, EditorComponentRenderMode } from '@ali/ide-editor/lib/browser';
import { ResourceService, IResource, WorkbenchEditorService } from '@ali/ide-editor';
import { EditorWelcomeComponent } from './welcome';
import { Autowired } from '@ali/common-di';
import { IWorkspaceService, WorkspaceServerPath, IWorkspaceServer } from '@ali/ide-workspace';
import { IWelcomeMetaData } from './common';

@Domain(BrowserEditorContribution, ClientAppContribution)
export class WelcomeContribution implements BrowserEditorContribution, ClientAppContribution {

  @Autowired(WorkspaceServerPath)
  workspaceServer: IWorkspaceServer;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponent({
      uid: 'welcome',
      scheme: 'welcome',
      component: EditorWelcomeComponent,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    });
    registry.registerEditorComponentResolver('welcome', (resource, results) => {
      results.push({
        type: 'component',
        componentId: 'welcome',
      });
    });
  }

  registerResource(service: ResourceService ) {
    service.registerResourceProvider({
      scheme: 'welcome',
      provideResource: async (uri: URI): Promise<IResource<IWelcomeMetaData>> => {
        return Promise.all([this.workspaceServer.getRecentWorkspacePaths(), this.workspaceServer.getMostRecentlyOpenedFiles()]).then(([workspaces, files]) => {
          return {
            uri,
            name: localize('welcome.title'),
            icon: '', // TODO
            metadata: {
              recentWorkspaces: workspaces || [],
              recentFiles: files || [],
            },
          };
        });
      },
    });
  }

  onDidStart() {
    if (!this.workspaceService.workspace) {
      this.editorService.open(new URI('welcome://'));
    }
  }

}
