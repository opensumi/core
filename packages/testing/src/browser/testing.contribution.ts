import { Emitter } from '@opensumi/ide-core-common';
import { TEST_DATA_SCHEME } from './../common/testingUri';
import { IEditor } from '@opensumi/ide-editor/lib/common';
import {
  BrowserEditorContribution,
  IEditorFeatureRegistry,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelContentProvider,
} from '@opensumi/ide-editor/lib/browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  CommandService,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  EDITOR_COMMANDS,
  Event,
  FileType,
  getIcon,
  localize,
  MaybePromise,
  SlotLocation,
  URI,
} from '@opensumi/ide-core-browser';
import { ClosePeekTest, GoToTestCommand, PeekTestError } from '../common/commands';

import { TestingContainerId, TestingViewId } from '../common/testing-view';
import { ITestTreeViewModel, TestTreeViewModelToken } from '../common/tree-view.model';
import { TestingView } from './components/testing.view';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { TestDecorationsContribution } from './test-decorations';
import { TestOutputPeekContribution } from './outputPeek/test-output-peek';
import { TestingPeekOpenerServiceToken } from '../common/testingPeekOpener';
import { TestingPeekOpenerServiceImpl } from './outputPeek/test-peek-opener.service';

@Injectable()
export class TestingOutputPeekDocumentProvider implements IEditorDocumentModelContentProvider {
  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    return Promise.resolve('??????????????????????');
  }
  isReadonly(uri: URI): MaybePromise<boolean> {
    return true;
  }
  handlesScheme(scheme: string) {
    return scheme === TEST_DATA_SCHEME;
  }
}

@Injectable()
@Domain(ClientAppContribution, ComponentContribution, CommandContribution, BrowserEditorContribution)
export class TestingContribution
  implements ClientAppContribution, ComponentContribution, CommandContribution, BrowserEditorContribution
{
  @Autowired(TestTreeViewModelToken)
  private readonly testTreeViewModel: ITestTreeViewModel;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(TestingPeekOpenerServiceToken)
  private readonly testingPeekOpenerService: TestingPeekOpenerServiceImpl;

  @Autowired()
  private readonly debugConsoleInputDocumentProvider: TestingOutputPeekDocumentProvider;

  initialize(): void {
    this.testTreeViewModel.initTreeModel();
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      TestingViewId,
      [],
      {
        iconClass: getIcon('test'),
        title: localize('test.title'),
        priority: 1,
        containerId: TestingContainerId,
        component: TestingView,
        activateKeyBinding: 'ctrlcmd+shift+t',
      },
      SlotLocation.left,
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(GoToTestCommand, {
      execute: async (extId: string) => {
        const test = this.testTreeViewModel.getTestItem(extId);
        if (!test) {
          return;
        }

        const { range, uri } = test.item;
        if (!uri) {
          return;
        }

        const fileStat = await this.filesystem.getFileStat(uri.toString());

        if (!fileStat) {
          return;
        }

        if (fileStat.type === FileType.Directory) {
          // ** filetree 未实现文件夹的 focus , 只能是将窗口切到资源管理器但无法选中文件夹 **
          this.commandService.executeCommand('revealInExplorer', uri);
          return;
        }

        if (fileStat.type === FileType.File) {
          this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, URI.parse(uri.toString()), {
            range,
            focus: true,
          });
        }
      },
      isVisible: () => false,
    });

    commands.registerCommand(PeekTestError, {
      execute: async (extId: string) => {
        this.testingPeekOpenerService.open();
      },
      isVisible: () => false,
    });

    commands.registerCommand(ClosePeekTest, {
      execute: async (uri: string) => {
        if (!uri) {
          return;
        }

        const ctor = this.testingPeekOpenerService.peekControllerMap.get(uri);
        if (ctor) {
          ctor.removePeek();
        }
      },
      isVisible: () => false,
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => this.injector.get(TestDecorationsContribution, [editor]).contribute(),
    });
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => this.injector.get(TestOutputPeekContribution, [editor]).contribute(),
    });
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.debugConsoleInputDocumentProvider);
  }
}
