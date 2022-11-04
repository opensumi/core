import { Injectable, Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-components';
import { EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { CommandService, CUSTOM_EDITOR_SCHEME, LifeCyclePhase, Schemes, URI } from '@opensumi/ide-core-common';
import { ResourceService } from '@opensumi/ide-editor';
import { IResource } from '@opensumi/ide-editor';
import { EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { Contributes, LifeCycle, VSCodeContributePoint } from '@opensumi/ide-extension';
import { IExtensionWalkthrough } from '@opensumi/ide-extension/lib/common/vscode';

import { IWalkthrough } from '../../../common';
import { WalkthroughsEditorView } from '../../components/walkthroughs-view';
import { WalkthroughsService } from '../../walkthroughs.service';

@Injectable()
@Contributes('walkthroughs')
@LifeCycle(LifeCyclePhase.Starting)
export class WalkthroughsContributionPoint extends VSCodeContributePoint<IExtensionWalkthrough[]> {
  @Autowired(EditorComponentRegistry)
  private readonly editorComponentRegistry: EditorComponentRegistry;

  @Autowired(WalkthroughsService)
  private readonly walkthroughsService: WalkthroughsService;

  @Autowired(ResourceService)
  private readonly resourceService: ResourceService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  contribute() {
    this.addDispose(this.walkthroughsService.onDidAddWalkthrough((w) => this.registerWalkthroughEditor(w)));

    this.addDispose(
      this.resourceService.registerResourceProvider({
        scheme: Schemes.walkThrough,
        provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => ({
          uri,
          icon: getIcon('smile'),
          supportsRevive: false,
          name: '欢迎使用',
        }),
      }),
    );

    this.addDispose(
      this.walkthroughsService.onDidOpenWalkthrough(async (id) => {
        const walkthrough = this.walkthroughsService.getWalkthrough(id);
        if (!walkthrough) {
          return;
        }

        await this.commandService.executeCommand(
          EDITOR_COMMANDS.OPEN_RESOURCE.id,
          URI.from({
            scheme: Schemes.walkThrough,
            authority: walkthrough.source,
            query: walkthrough.id,
            path: '/' + walkthrough.id,
          }),
          {
            disableNavigate: true,
            preview: false,
            forceOpenType: {
              type: 'component',
              componentId: this.toComponentId(walkthrough.id),
            },
          },
        );
      }),
    );

    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      if (!contributes.length) {
        return;
      }

      for (const walkthrough of contributes) {
        this.walkthroughsService.registerExtensionWalkthroughContributions(extensionId, walkthrough);
      }
    }
  }

  private toComponentId(id: string) {
    return `${CUSTOM_EDITOR_SCHEME}-${id}`;
  }

  private registerWalkthroughEditor(description: IWalkthrough): void {
    this.addDispose(
      this.editorComponentRegistry.registerEditorComponent({
        uid: this.toComponentId(description.id),
        component: WalkthroughsEditorView,
        scheme: Schemes.walkThrough,
      }),
    );

    this.addDispose(
      this.editorComponentRegistry.registerEditorComponentResolver(Schemes.walkThrough, (_, __, resolve) => {
        resolve([
          {
            type: 'component',
            componentId: this.toComponentId(description.id),
          },
        ]);
      }),
    );
  }
}
