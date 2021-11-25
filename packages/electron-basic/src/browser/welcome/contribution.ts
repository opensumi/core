import { Domain, URI, localize, ClientAppContribution, RecentFilesManager } from '@opensumi/ide-core-browser';
import { BrowserEditorContribution, EditorComponentRegistry, EditorComponentRenderMode } from '@opensumi/ide-editor/lib/browser';
import { ResourceService, IResource, WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorWelcomeComponent } from './welcome';
import { Autowired } from '@opensumi/common-di';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWelcomeMetaData } from './common';

@Domain(BrowserEditorContribution, ClientAppContribution)
export class WelcomeContribution implements BrowserEditorContribution, ClientAppContribution {

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(RecentFilesManager)
  private readonly recentFilesManager: RecentFilesManager;

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

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: 'welcome',
      provideResource: async (uri: URI): Promise<IResource<IWelcomeMetaData>> => {
        return Promise.all([this.workspaceService.getMostRecentlyUsedWorkspaces(), this.recentFilesManager.getMostRecentlyOpenedFiles()]).then(([workspaces, files]) => {
          return {
            uri,
            name: localize('welcome.title'),
            icon: '',
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
