import { Emitter } from '@opensumi/ide-core-common';
import { TEST_DATA_SCHEME } from './../common/testingUri';
import { IEditor } from '@opensumi/ide-editor/lib/common';
import {
  BrowserEditorContribution,
  IEditorFeatureRegistry,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelContentProvider,
  WorkbenchEditorService,
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
  KeybindingContribution,
  KeybindingRegistry,
  localize,
  MaybePromise,
  SlotLocation,
  URI,
} from '@opensumi/ide-core-browser';
import {
  ClosePeekTest,
  DebugTestCommand,
  GoToTestCommand,
  PeekTestError,
  RuntTestCommand,
  TestingDebugCurrentFile,
  TestingRunCurrentFile,
} from '../common/commands';

import { TestingContainerId, TestingViewId } from '../common/testing-view';
import { ITestTreeViewModel, TestTreeViewModelToken } from '../common/tree-view.model';
import { TestingView } from './components/testing.view';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { TestDecorationsContribution } from './test-decorations';
import { TestOutputPeekContribution } from './outputPeek/test-output-peek';
import { TestingPeekOpenerServiceToken } from '../common/testingPeekOpener';
import { TestingPeekOpenerServiceImpl } from './outputPeek/test-peek-opener.service';
import { TestServiceImpl } from './test.service';
import { TestServiceToken } from '../common';
import { TestRunProfileBitset } from '../common/testCollection';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

@Injectable()
export class TestingOutputPeekDocumentProvider implements IEditorDocumentModelContentProvider {
  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    return Promise.resolve('');
  }
  isReadonly(uri: URI): MaybePromise<boolean> {
    return true;
  }
  handlesScheme(scheme: string) {
    return scheme === TEST_DATA_SCHEME;
  }
}

@Injectable()
@Domain(
  ClientAppContribution,
  ComponentContribution,
  CommandContribution,
  BrowserEditorContribution,
  MenuContribution,
  KeybindingContribution,
)
export class TestingContribution
  implements
    ClientAppContribution,
    ComponentContribution,
    CommandContribution,
    BrowserEditorContribution,
    MenuContribution,
    KeybindingContribution
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
  private readonly testingOutputPeekDocumentProvider: TestingOutputPeekDocumentProvider;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(TestServiceToken)
  private readonly testService: TestServiceImpl;

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
    commands.registerCommand(RuntTestCommand, {
      execute: async (extId: string) => {
        const test = this.testTreeViewModel.getTestItem(extId);
        if (!test) {
          return;
        }

        await this.testService.runTests({
          group: TestRunProfileBitset.Run,
          tests: [test],
        });
      },
    });

    commands.registerCommand(DebugTestCommand, {
      execute: async (extId: string) => {
        const test = this.testTreeViewModel.getTestItem(extId);
        if (!test) {
          return;
        }

        await this.testService.runTests({
          group: TestRunProfileBitset.Debug,
          tests: [test],
        });
      },
    });

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
      execute: async (uri: string | undefined) => {
        uri = uri ?? this.editorService.currentEditor?.currentUri?.toString();

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

    commands.registerCommand(TestingRunCurrentFile, {
      execute: async () => {
        executeTestsInCurrentFile(TestRunProfileBitset.Run);
      },
    });

    commands.registerCommand(TestingDebugCurrentFile, {
      execute: async () => {
        executeTestsInCurrentFile(TestRunProfileBitset.Debug);
      },
    });

    const executeTestsInCurrentFile = (group: TestRunProfileBitset) => {
      const currentEditor = this.editorService.currentEditor;
      const monacoEditor = currentEditor?.monacoEditor;
      const position = monacoEditor?.getPosition();
      const model = monacoEditor?.getModel();

      if (!position || !model || !('uri' in model)) {
        return;
      }

      const demandedUri = model.uri.toString();
      for (const test of this.testService.collection.all) {
        if (test.item.uri?.toString() === demandedUri) {
          this.testService.runTests({
            tests: [test],
            group,
          });
        }
      }
    };
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: ClosePeekTest.id,
      keybinding: 'esc',
      // when: `!${CONTEXT_IN_DEBUG_MODE.raw}`,
    });
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.TestingGlyphMarginContext, {
      command: RuntTestCommand.id,
      group: '1_has_decoration',
      order: 1,
    });
    menuRegistry.registerMenuItem(MenuId.TestingGlyphMarginContext, {
      command: DebugTestCommand.id,
      group: '1_has_decoration',
      order: 2,
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
    registry.registerEditorDocumentModelContentProvider(this.testingOutputPeekDocumentProvider);
  }
}
