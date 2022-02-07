import { Emitter, Schemas } from '@opensumi/ide-core-common';
import { TEST_DATA_SCHEME } from './../common/testingUri';
import { IEditor } from '@opensumi/ide-editor/lib/common';
import {
  BrowserEditorContribution,
  IEditorFeatureRegistry,
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelContentProvider,
  WorkbenchEditorService,
  EditorCollectionService,
  EditorComponentRegistry,
  ResourceService,
  IResource,
  IMarkdownString,
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
  IOpener,
  IOpenerService,
  KeybindingContribution,
  KeybindingRegistry,
  localize,
  MaybePromise,
  OpenerContribution,
  SlotLocation,
  URI,
} from '@opensumi/ide-core-browser';
import {
  ClearTestResults,
  ClosePeekTest,
  DebugTestCommand,
  GoToNextMessage,
  GoToPreviousMessage,
  GoToTestCommand,
  OpenMessageInEditor,
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
import { TestResultServiceImpl } from './test.result.service';
import { TestResultServiceToken } from '../common/test-result';
import { MarkdownEditorComponent } from '@opensumi/ide-markdown/lib/browser/editor.markdown';
import { MARKDOWN_EDITOR_COMPONENT_ID } from '@opensumi/ide-markdown/lib/browser/contribution';

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
  OpenerContribution,
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

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

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
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: ClosePeekTest.id,
      keybinding: 'esc',
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

    componentRegistry.registerEditorComponentResolver(TEST_DATA_SCHEME, (resource, results) => {
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
