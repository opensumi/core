import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, PreferenceSchema, localize, URI } from '@ali/ide-core-common';
import { ClientAppContribution, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Disposable } from '@ali/ide-core-common/lib/disposable';

import { SCMPanel } from './scm.view';
import { scmContainerId, IDirtyDiffWorkbenchController, OPEN_DIRTY_DIFF_WIDGET, GOTO_NEXT_CHANGE, GOTO_PREVIOUS_CHANGE } from '../common';
import { SCMBadgeController, SCMStatusBarController } from './scm-activity';
import { scmPreferenceSchema } from './scm-preference';
import { DirtyDiffWorkbenchController } from './dirty-diff';
import { getIcon } from '@ali/ide-core-browser';
import { WorkbenchEditorService, EditorCollectionService, IEditor } from '@ali/ide-editor/lib/common';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

@Domain(ClientAppContribution, CommandContribution, ComponentContribution, PreferenceContribution, MainLayoutContribution, NextMenuContribution)
export class SCMContribution implements CommandContribution, ClientAppContribution, ComponentContribution, PreferenceContribution, MainLayoutContribution, NextMenuContribution {

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

  onDidRender() {
    [
      this.statusUpdater,
      this.statusBarController,
      this.dirtyDiffWorkbenchController,
    ].forEach((controller) => {
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
            lineNumber, column: 1,
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
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-scm', [], {
      iconClass: getIcon('scm'),
      title: localize('scm.title'),
      priority: 8,
      containerId: scmContainerId,
      component: SCMPanel,
      activateKeyBinding: 'ctrlcmd+shift+g',
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
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
    const [ diffEditor ] = this.editorCollectionService.listDiffEditors().filter((diffEditor) => diffEditor.modifiedEditor.getId() === editorId || diffEditor.originalEditor.getId() === editorId);
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
