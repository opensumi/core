import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  PreferenceContribution,
  PreferenceService,
  getExternalIcon,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  CommandContribution,
  CommandRegistry,
  Command,
  PreferenceSchema,
  localize,
  URI,
  PreferenceScope,
} from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { WorkbenchEditorService, EditorCollectionService, IEditor } from '@opensumi/ide-editor/lib/common';
import { IViewsRegistry, MainLayoutContribution } from '@opensumi/ide-main-layout';

import {
  scmContainerId,
  IDirtyDiffWorkbenchController,
  OPEN_DIRTY_DIFF_WIDGET,
  GOTO_NEXT_CHANGE,
  GOTO_PREVIOUS_CHANGE,
  TOGGLE_DIFF_SIDE_BY_SIDE,
  scmResourceViewId,
  SET_SCM_TREE_VIEW_MODE,
  SET_SCM_LIST_VIEW_MODE,
  SCMViewModelMode,
} from '../common';

import { SCMTreeService } from './components/scm-resource-tree/scm-tree.service';
import { DirtyDiffWorkbenchController } from './dirty-diff';
import { SCMBadgeController, SCMStatusBarController } from './scm-activity';
import { scmPreferenceSchema } from './scm-preference';
import { SCMViewContainer } from './scm-view-container';


export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

@Domain(
  ClientAppContribution,
  CommandContribution,
  ComponentContribution,
  PreferenceContribution,
  MainLayoutContribution,
  MenuContribution,
)
export class SCMContribution
  implements
    CommandContribution,
    ClientAppContribution,
    ComponentContribution,
    PreferenceContribution,
    MainLayoutContribution,
    MenuContribution
{
  @Autowired(SCMBadgeController)
  private readonly statusUpdater: SCMBadgeController;

  @Autowired(SCMStatusBarController)
  private readonly statusBarController: SCMStatusBarController;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IDirtyDiffWorkbenchController)
  private readonly dirtyDiffWorkbenchController: DirtyDiffWorkbenchController;

  @Autowired(EditorCollectionService)
  private readonly editorCollectionService: EditorCollectionService;

  private toDispose = new Disposable();

  schema: PreferenceSchema = scmPreferenceSchema;

  private diffChangesIndex: Map<URI, number> = new Map();

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired()
  private readonly scmTreeService: SCMTreeService;

  @Autowired(IViewsRegistry)
  private readonly viewsRegistry: IViewsRegistry;

  onStart() {
    this.viewsRegistry.registerViewWelcomeContent(scmResourceViewId, {
      content: localize('welcome-view.noOpenRepo', 'No source control providers registered.'),
      when: 'default',
    });
  }

  onDidRender() {
    [this.statusUpdater, this.statusBarController, this.dirtyDiffWorkbenchController].forEach((controller) => {
      controller.start();
      this.toDispose.addDispose(controller);
    });
  }

  onStop() {
    this.toDispose.dispose();
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(OPEN_DIRTY_DIFF_WIDGET, {
      execute: async (lineNumber: number) => {
        const editor = this.editorService.currentEditor;
        if (editor) {
          const codeEditor = editor.monacoEditor;
          this.dirtyDiffWorkbenchController.toggleDirtyDiffWidget(codeEditor, {
            lineNumber,
            column: 1,
          });
          setTimeout(() => {
            codeEditor.revealLineInCenter(lineNumber);
          }, 50);
        }
      },
    });

    commands.registerCommand(GOTO_PREVIOUS_CHANGE, {
      execute: () => {
        const editor = this.editorService.currentEditor;
        if (editor && editor.currentUri) {
          editor.monacoEditor.revealLineInCenter(this.getDiffChangeLineNumber(editor.currentUri, editor, 'previous'));
        }
      },
    });

    commands.registerCommand(GOTO_NEXT_CHANGE, {
      execute: () => {
        const editor = this.editorService.currentEditor;
        if (editor && editor.currentUri) {
          editor.monacoEditor.revealLineInCenter(this.getDiffChangeLineNumber(editor.currentUri, editor, 'next'));
        }
      },
    });

    commands.registerCommand(TOGGLE_DIFF_SIDE_BY_SIDE, {
      execute: () => {
        const newValue = !this.preferenceService.get<boolean>('diffEditor.renderSideBySide');
        this.preferenceService.set('diffEditor.renderSideBySide', newValue, PreferenceScope.User);
      },
    });

    commands.registerCommand(SET_SCM_TREE_VIEW_MODE, {
      execute: () => {
        this.scmTreeService.changeTreeMode(true);
      },
    });
    commands.registerCommand(SET_SCM_LIST_VIEW_MODE, {
      execute: () => {
        this.scmTreeService.changeTreeMode(false);
      },
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-scm', [], {
      iconClass: getIcon('scm'),
      title: localize('scm.title'),
      priority: 8,
      containerId: scmContainerId,
      component: SCMViewContainer,
      activateKeyBinding: 'ctrlcmd+shift+g',
    });
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: GOTO_PREVIOUS_CHANGE.id,
        label: localize('scm.diff.change.previous'),
      },
      when: 'isInDiffEditor',
      iconClass: getIcon('arrowup'),
      group: 'navigation',
    });
    menuRegistry.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: GOTO_NEXT_CHANGE.id,
        label: localize('scm.diff.change.next'),
      },
      iconClass: getIcon('arrowdown'),
      when: 'isInDiffEditor',
      group: 'navigation',
    });
    menuRegistry.registerMenuItem(MenuId.EditorTitle, {
      command: {
        id: TOGGLE_DIFF_SIDE_BY_SIDE.id,
        label: localize('scm.diff.toggle.renderSideBySide'),
      },
      when: 'isInDiffEditor',
      group: '1_internal',
    });
    menuRegistry.registerMenuItem(MenuId.SCMTitle, {
      command: {
        id: SET_SCM_TREE_VIEW_MODE.id,
        label: localize('setTreeViewMode', 'View as Tree'),
      },
      iconClass: getExternalIcon('list-tree'),
      when: `config.scm.defaultViewMode == ${SCMViewModelMode.List}`,
      group: 'navigation',
      order: -1,
    });
    menuRegistry.registerMenuItem(MenuId.SCMTitle, {
      command: {
        id: SET_SCM_LIST_VIEW_MODE.id,
        label: localize('setListViewMode', 'View as List'),
      },
      iconClass: getExternalIcon('list-flat'),
      when: `config.scm.defaultViewMode == ${SCMViewModelMode.Tree}`,
      group: 'navigation',
      order: -1,
    });
  }

  private getDiffChangesIndex(uri: URI, editor: IEditor) {
    if (!this.diffChangesIndex.has(uri)) {
      editor.onDispose(() => {
        this.diffChangesIndex.delete(uri);
      });
      this.diffChangesIndex.set(uri, 0);
    }
    return this.diffChangesIndex.get(uri)!;
  }

  private getDiffEditor(editor: IEditor) {
    const editorId = editor.getId();
    const [diffEditor] = this.editorCollectionService
      .listDiffEditors()
      .filter(
        (diffEditor) =>
          diffEditor.modifiedEditor.getId() === editorId || diffEditor.originalEditor.getId() === editorId,
      );
    return diffEditor;
  }

  private getDiffChangeLineNumber(uri: URI, editor: IEditor, type: 'previous' | 'next') {
    const diffChangesIndex = this.getDiffChangesIndex(uri, editor);
    const diffEditor = this.getDiffEditor(editor);
    const lineChanges = diffEditor.getLineChanges() || [];
    if (!lineChanges || lineChanges.length === 0) {
      return 0;
    }
    let index = 0;
    if (type === 'previous') {
      index = diffChangesIndex - 1 < 0 ? lineChanges.length - 1 : diffChangesIndex - 1;
    } else {
      index = diffChangesIndex >= lineChanges.length - 1 ? 0 : diffChangesIndex + 1;
    }
    this.diffChangesIndex.set(uri, index);
    return lineChanges[index].modifiedStartLineNumber;
  }
}
