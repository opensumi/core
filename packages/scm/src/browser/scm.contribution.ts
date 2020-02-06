import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService, PreferenceSchema, localize } from '@ali/ide-core-common';
import { Logger, ClientAppContribution, IContextKeyService, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MainLayoutContribution } from '@ali/ide-main-layout';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Disposable } from '@ali/ide-core-common/lib/disposable';

import { SCMPanel } from './scm.view';
import { SCMService, scmContainerId, IDirtyDiffWorkbenchController, OPEN_DIRTY_DIFF_WIDGET, GOTO_NEXT_CHANGE, GOTO_PREVIOUS_CHANGE } from '../common';
import { SCMBadgeController, SCMStatusBarController } from './scm-activity';
import { scmPreferenceSchema } from './scm-preference';
import { DirtyDiffWorkbenchController } from './dirty-diff';
import { getIcon } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { BrowserEditorContribution, IEditorActionRegistry } from '@ali/ide-editor/lib/browser';

export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

@Domain(ClientAppContribution, CommandContribution, ComponentContribution, PreferenceContribution, MainLayoutContribution, BrowserEditorContribution)
export class SCMContribution implements CommandContribution, ClientAppContribution, ComponentContribution, PreferenceContribution, MainLayoutContribution, BrowserEditorContribution {
  @Autowired()
  protected readonly logger: Logger;

  @Autowired(IContextKeyService)
  protected readonly contextService: IContextKeyService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(SCMService)
  protected readonly scmService: SCMService;

  @Autowired(SCMBadgeController)
  protected readonly statusUpdater: SCMBadgeController;

  @Autowired(SCMStatusBarController)
  protected readonly statusBarController: SCMStatusBarController;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(IDirtyDiffWorkbenchController)
  protected readonly dirtyDiffWorkbenchController: DirtyDiffWorkbenchController;

  private toDispose = new Disposable();

  schema: PreferenceSchema = scmPreferenceSchema;

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
        const curModel = this.dirtyDiffWorkbenchController.curModel;
        if (editor && curModel) {
          const codeEditor = editor.monacoEditor;
          setTimeout(() => {
            codeEditor.revealLineInCenter(curModel.getPreviousChangeLineNumber());
          }, 50);
        }
      },
    });

    commands.registerCommand(GOTO_NEXT_CHANGE, {
      execute: () => {
        const editor = this.editorService.currentEditor;
        const curModel = this.dirtyDiffWorkbenchController.curModel;
        if (editor && curModel) {
          const codeEditor = editor.monacoEditor;
          setTimeout(() => {
            codeEditor.revealLineInCenter(curModel.getNextChangeLineNumber());
          }, 50);
        }
      },
    });

  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-scm', [], {
      iconClass: getIcon('scm'),
      title: localize('scm.title'),
      priority: 5,
      containerId: scmContainerId,
      component: SCMPanel,
      activateKeyBinding: 'ctrlcmd+shift+g',
    });
  }

  registerEditorActions(registry: IEditorActionRegistry) {
    registry.registerEditorAction({
      iconClass: getIcon('up'),
      title: localize('scm.diff.change.previous'),
      when: 'isInDiffEditor',
      onClick: () => {
        this.commandService.executeCommand(GOTO_PREVIOUS_CHANGE.id);
      },
    });

    registry.registerEditorAction({
      iconClass: getIcon('down'),
      title: localize('scm.diff.change.next'),
      when: 'isInDiffEditor',
      onClick: () => {
        this.commandService.executeCommand(GOTO_NEXT_CHANGE.id);
      },
    });

  }
}
