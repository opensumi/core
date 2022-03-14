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
  KeybindingScope,
  KeybindingWeight,
  MaybePromise,
  TabBarToolbarContribution,
  ToolbarRegistry,
  URI,
} from '@opensumi/ide-core-browser';
import { TestingIsPeekVisible } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { Emitter, IMarkdownString } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  IEditorFeatureRegistry,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelContentProvider,
  WorkbenchEditorService,
  EditorComponentRegistry,
  ResourceService,
  IResource,
} from '@opensumi/ide-editor/lib/browser';
import { IEditor } from '@opensumi/ide-editor/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { MARKDOWN_EDITOR_COMPONENT_ID } from '@opensumi/ide-markdown/lib/browser/contribution';
import { MarkdownEditorComponent } from '@opensumi/ide-markdown/lib/browser/editor.markdown';

import { TestServiceToken } from '../common';
import {
  ClearTestResults,
  ClosePeekTest,
  DebugAllTestCommand,
  DebugTestCommand,
  GoToNextMessage,
  GoToPreviousMessage,
  GoToTestCommand,
  OpenMessageInEditor,
  PeekTestError,
  RuntAllTestCommand,
  RuntTestCommand,
  TestingDebugCurrentFile,
  TestingRunCurrentFile,
} from '../common/commands';
import { Testing } from '../common/constants';
import { TestResultServiceToken } from '../common/test-result';
import { TestRunProfileBitset } from '../common/testCollection';
import { TestingPeekOpenerServiceToken } from '../common/testingPeekOpener';
import { ITestTreeViewModel, TestTreeViewModelToken } from '../common/tree-view.model';

import { TEST_DATA_SCHEME } from './../common/testingUri';
import { TestOutputPeekContribution } from './outputPeek/test-output-peek';
import { TestingPeekOpenerServiceImpl } from './outputPeek/test-peek-opener.service';
import { TestDecorationsContribution } from './test-decorations';
import { TestResultServiceImpl } from './test.result.service';
import { TestServiceImpl } from './test.service';

@Injectable()
export class TestingOutputPeekDocumentProvider implements IEditorDocumentModelContentProvider {
  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    const dto = this.testResultService.retrieveTest(uri);
    if (!dto) {
      return '';
    }

    const message = dto.messages[dto.messageIndex];

    if (dto.isDiffable || typeof message.message === 'string') {
      return '';
    }

    const mdStr = message.message;
    const content = mdStr ? (mdStr as IMarkdownString).value.replace(/\t/g, '') : '';

    return content;
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
  TabBarToolbarContribution,
)
export class TestingContribution
  implements
    ClientAppContribution,
    ComponentContribution,
    CommandContribution,
    BrowserEditorContribution,
    MenuContribution,
    KeybindingContribution,
    TabBarToolbarContribution
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

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  initialize(): void {
    this.testTreeViewModel.initTreeModel();
  }

  registerComponent(registry: ComponentRegistry): void {}

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

    commands.registerCommand(GoToPreviousMessage, {
      execute: async (uri: string | undefined) => {
        uri = uri ?? this.editorService.currentEditor?.currentUri?.toString();

        if (!uri) {
          return;
        }

        const ctor = this.testingPeekOpenerService.peekControllerMap.get(uri);
        if (ctor) {
          ctor.previous();
        }
      },
    });

    commands.registerCommand(GoToNextMessage, {
      execute: async (uri: string | undefined) => {
        uri = uri ?? this.editorService.currentEditor?.currentUri?.toString();

        if (!uri) {
          return;
        }

        const ctor = this.testingPeekOpenerService.peekControllerMap.get(uri);
        if (ctor) {
          ctor.next();
        }
      },
    });

    commands.registerCommand(ClearTestResults, {
      execute: async (uri: string | undefined) => {
        this.testResultService.clear();
        this.commandService.executeCommand(ClosePeekTest.id, uri);
      },
    });

    commands.registerCommand(OpenMessageInEditor, {
      execute: async (uri: string | undefined) => {
        uri = uri ?? this.editorService.currentEditor?.currentUri?.toString();

        if (!uri) {
          return;
        }

        const ctor = this.testingPeekOpenerService.peekControllerMap.get(uri);
        if (ctor) {
          ctor.openCurrentInEditor();
        }
      },
    });

    const runOrDebugAllTestsAction = async (group: TestRunProfileBitset) => {
      const roots = [...this.testService.collection.rootItems];
      if (!roots.length) {
        return;
      }

      await this.testService.runTests({ tests: roots, group });
    };

    commands.registerCommand(RuntAllTestCommand, {
      execute: async () => {
        await runOrDebugAllTestsAction(TestRunProfileBitset.Run);
      },
    });

    commands.registerCommand(DebugAllTestCommand, {
      execute: async () => {
        await runOrDebugAllTestsAction(TestRunProfileBitset.Debug);
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: ClosePeekTest.id,
      keybinding: 'esc',
      when: TestingIsPeekVisible.equalsTo(true),
    });
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    /** glyph margin start */
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
    /** glyph margin end */

    /** output peek view actions start */
    menuRegistry.registerMenuItem(MenuId.TestPeekTitleContext, {
      command: GoToPreviousMessage.id,
      iconClass: GoToPreviousMessage.iconClass,
      group: 'navigation',
      order: 5,
    });
    menuRegistry.registerMenuItem(MenuId.TestPeekTitleContext, {
      command: GoToNextMessage.id,
      iconClass: GoToNextMessage.iconClass,
      group: 'navigation',
      order: 6,
    });
    menuRegistry.registerMenuItem(MenuId.TestPeekTitleContext, {
      command: ClearTestResults.id,
      iconClass: ClearTestResults.iconClass,
      group: 'navigation',
      order: 7,
    });
    menuRegistry.registerMenuItem(MenuId.TestPeekTitleContext, {
      command: OpenMessageInEditor.id,
      iconClass: OpenMessageInEditor.iconClass,
      group: 'navigation',
      order: 9,
    });
    /** output peek view actions end */
  }

  registerToolbarItems(registry: ToolbarRegistry): void {
    registry.registerItem({
      id: RuntAllTestCommand.id,
      command: RuntAllTestCommand.id,
      viewId: Testing.ExplorerViewId,
    });
    registry.registerItem({
      id: DebugAllTestCommand.id,
      command: DebugAllTestCommand.id,
      viewId: Testing.ExplorerViewId,
    });
    registry.registerItem({
      id: ClearTestResults.id,
      command: ClearTestResults.id,
      viewId: Testing.ExplorerViewId,
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

  registerEditorComponent(componentRegistry: EditorComponentRegistry) {
    componentRegistry.registerEditorComponent({
      uid: MARKDOWN_EDITOR_COMPONENT_ID,
      component: MarkdownEditorComponent,
      scheme: TEST_DATA_SCHEME,
    });

    componentRegistry.registerEditorComponentResolver(TEST_DATA_SCHEME, (_, results) => {
      results.push({
        type: 'component',
        componentId: MARKDOWN_EDITOR_COMPONENT_ID,
        weight: 10,
      });
    });
  }

  registerResource(service: ResourceService) {
    service.registerResourceProvider({
      scheme: TEST_DATA_SCHEME,
      provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => ({
        uri,
        icon: getIcon('file-text'),
        name: `Preview ${uri.displayName}`,
      }),
    });
  }
}
