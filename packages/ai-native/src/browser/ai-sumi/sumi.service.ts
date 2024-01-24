import differenceWith from 'lodash/differenceWith';

import { Autowired, Injectable } from '@opensumi/di';
import {
  Command,
  CommandRegistry,
  CommandService,
  ILogServiceClient,
  ILoggerManagerClient,
  SupportLogNamespace,
} from '@opensumi/ide-core-common';
import { AiBackSerivcePath, IAiBackService, IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { AiChatService } from '../ai-chat.service';
import { SumiCommandPromptManager } from '../prompts/sumi.command';

const InnerCommandGroups = {
  'File and Editor Management': [
    'file.new.untitled',
    'editor.saveCurrent',
    'editor.close',
    'editor.closeAllInGroup',
    'editor.closeSaved',
    'editor.closeOtherEditorsInGroup',
    'editor.closeToRight',
    'editor.document.revert',
    'editor.saveAll',
    'editor.closeAll',
    'filetree.focus.files',
    'filetree.copy.path',
    'workbench.action.quickOpen',
    'toolbar.showCustomizePanel',
    'connection.start.rtt',
    'connection.stop.rtt',
    'comments.panel.action.collapse',
    'comments.thread.action.close',
    'workbench.action.tasks.runTask',
    'workbench.action.tasks.reRunTask',
    'ai.suggest.documentation',
    'python.datascience.notebookeditor.undocells',
    'python.datascience.notebookeditor.redocells',
    'workbench.action.showEmmetCommands',
    'merge-conflict.accept.all-current',
    'merge-conflict.accept.all-incoming',
    'merge-conflict.accept.all-both',
    'merge-conflict.accept.current',
    'merge-conflict.accept.incoming',
    'merge-conflict.accept.selection',
    'merge-conflict.accept.both',
    'merge-conflict.next',
    'merge-conflict.previous',
    'merge-conflict.compare',
    'typescript.reloadProjects',
    'javascript.reloadProjects',
    'typescript.selectTypeScriptVersion',
    'typescript.goToProjectConfig',
    'javascript.goToProjectConfig',
    'typescript.openTsServerLog',
    'typescript.restartTsServer',
    'typescript.findAllFileReferences',
    'view-container.hide.test',
    'python_tests.focus',
    'jsBrowserBreakpoints.focus',
    'jsExcludedCallers.focus',
    'TREE_VIEW_COLLAPSE_ALL_WORKER',
    '_vscode_delegate_cmd_lowwqr3c',
    'TREE_VIEW_COLLAPSE_ALL',
    '_vscode_delegate_cmd_lowwqrp7',
    '_typescript.configurePlugin',
    '_typescript.learnMoreAboutRefactorings',
    '_typescript.projectStatus',
    'js.projectStatus.command',
    '_typescript.applyCompletionCodeAction',
    '_typescript.onCompletionAccepted',
    '_typescript.applyCompletionCommand',
    '_typescript.organizeImports',
    '_typescript.applyCodeActionCommand',
    '_typescript.applyFixAllCodeAction',
    '_typescript.didApplyRefactoring',
    '_typescript.selectRefactoring',
    'emmet.expandAbbreviation',
    'git.openResource',
  ],
  'Version Control and Git': [
    'git.setLogLevel',
    'git.clone',
    'git.cloneRecursive',
    'git.init',
    'git.openRepository',
    'git.close',
    'git.refresh',
    'git.openChange',
    'git.openAllChanges',
    'git.openFile',
    'git.openFile2',
    'git.openHEADFile',
    'git.stage',
    'git.stageAll',
    'git.stageAllTracked',
    'git.stageAllUntracked',
    'git.stageAllMerge',
    'git.stageSelectedRanges',
    'git.revertSelectedRanges',
    'git.stageChange',
    'git.revertChange',
    'git.unstage',
    'git.unstageAll',
    'git.unstageSelectedRanges',
    'git.clean',
    'git.cleanAll',
    'git.cleanAllTracked',
    'git.cleanAllUntracked',
    'git.rename',
    'git.commit',
    'git.commitStaged',
    'git.commitEmpty',
    'git.commitStagedSigned',
    'git.commitStagedAmend',
    'git.commitAll',
    'git.commitAllSigned',
    'git.commitAllAmend',
    'git.commitNoVerify',
    'git.commitStagedNoVerify',
    'git.commitEmptyNoVerify',
    'git.commitStagedSignedNoVerify',
    'git.commitStagedAmendNoVerify',
    'git.commitAllNoVerify',
    'git.commitAllSignedNoVerify',
    'git.commitAllAmendNoVerify',
    'git.restoreCommitTemplate',
    'git.undoCommit',
    'git.checkout',
    'git.checkoutDetached',
    'git.branch',
    'git.branchFrom',
    'git.deleteBranch',
    'git.renameBranch',
    'git.merge',
    'git.rebase',
    'git.createTag',
    'git.deleteTag',
    'git.fetch',
    'git.fetchPrune',
    'git.fetchAll',
    'git.pull',
    'git.pullRebase',
    'git.pullFrom',
    'git.push',
    'git.pushForce',
    'git.pushTo',
    'git.pushToForce',
    'git.pushTags',
    'git.pushWithTags',
    'git.pushWithTagsForce',
    'git.cherryPick',
    'git.addRemote',
    'git.removeRemote',
    'git.sync',
    'git.syncRebase',
    'git.publish',
    'git.showOutput',
    'git.ignore',
    'git.revealInExplorer',
    'git.revealFileInOS.linux',
    'git.revealFileInOS.mac',
    'git.revealFileInOS.windows',
    'git.stashIncludeUntracked',
    'git.stash',
    'git.stashPop',
    'git.stashPopLatest',
    'git.stashApply',
    'git.stashApplyLatest',
    'git.stashDrop',
    'git.stashDropAll',
    'git.timeline.openDiff',
    'git.timeline.copyCommitId',
    'git.timeline.copyCommitMessage',
    'git.timeline.selectForCompare',
    'git.timeline.compareWithSelected',
    'git.rebaseAbort',
    'git.closeAllDiffEditors',
    'git.api.getRepositories',
    'git.api.getRepositoryState',
    'git.api.getRemoteSources',
    'git.acceptMerge',
    '_git.openMergeEditor',
    'git._syncAll',
    'git.openResource',
  ],
  'Debugging and Testing': [
    'debug.edit.breakpoint',
    'debug.disable.breakpoint',
    'debug.enable.breakpoint',
    'debug.delete.breakpoint',
    'debug.add.conditional',
    'debug.add.logpoint',
    'debug.add.breakpoint',
    'debug.action.runToCursor',
    'debug.action.forceRunToCursor',
    'debug.console.clear',
    'debug.console.collapseAll',
    'testing.run.test',
    'testing.debug.test',
    'testing.goto.test',
    'testing.peek.test.error',
    'testing.peek.test.close',
    'testing.runCurrentFile',
    'testing.debugCurrentFile',
    'testing.goToPreviousMessage',
    'testing.goToNextMessage',
    'testing.clearTestResults',
    'testing.openMessageInEditor',
    'testing.refresshTests',
    'testing.runAll',
    'testing.debugAll',
  ],
  'Terminal and Command Line': [
    'terminal.search',
    'terminal.split',
    'terminal.clear',
    'terminal.add',
    'terminal.toggleTerminal',
    'terminal.search.next',
    'terminal.remove',
    'terminal.selectAllContent',
    'terminal.clearContent',
    'terminal.clearAllContent',
    'terminal.selectTypeZsh',
    'terminal.selectTypeBash',
    'terminal.selectTypeSh',
    'terminal.selectTypePowerShell',
    'terminal.selectTypeCMD',
    'terminal.moreSettings',
    'terminal.copy',
    'terminal.paste',
    'terminal.selectAll',
    'workbench.action.terminal.focusNextPane',
    'workbench.action.terminal.focusPreviousPane',
    'terminal.killProcess',
    'TerminalProfilesCommand:bash:bash',
    'TerminalProfilesCommand:zsh:zsh',
    'TerminalProfilesCommand:ms-vscode.js-debug:extension.js-debug.debugTerminal',
  ],
  'User Interface and Layout Management': [
    'container.show.explorer',
    'container.show.search',
    'container.show.scm',
    'container.show.extension',
    'container.show.debug',
    'main-layout.bottom-panel.expand',
    'main-layout.bottom-panel.retract',
    'main-layout.bottom-panel.toggle',
    'container.show.terminal',
    'container.show.output',
    'container.show.debug-console',
    'container.show.markers',
    'container.show.ai_chat',
    'main-layout.left-panel.hide',
    'main-layout.left-panel.show',
    'main-layout.left-panel.toggle',
    'main-layout.right-panel.hide',
    'main-layout.right-panel.show',
    'main-layout.right-panel.toggle',
    'workbench.action.closeSidebar',
    'main-layout.bottom-panel.show',
    'main-layout.bottom-panel.hide',
    'layout.action.openView',
    'editor.splitToLeft',
    'editor.splitToRight',
    'editor.splitToTop',
    'editor.splitToBottom',
    'editor.evenEditorGroups',
    'editor.closeOtherGroup',
    'theme.toggle',
    'theme.icon.toggle',
    'editor.action.fontZoomIn',
    'editor.action.fontZoomOut',
    'editor.action.fontZoomReset',
    'workbench.action.reloadWindow',
  ],
  'Code Editing and Refactoring': [
    'editor.undo',
    'editor.redo',
    'editor.selectAll',
    'editor.action.formatDocument',
    'editor.action.formatSelection',
    'editor.action.indentationToSpaces',
    'editor.action.indentationToTabs',
    'editor.action.indentUsingTabs',
    'editor.action.indentUsingSpaces',
    'editor.action.detectIndentation',
    'editor.action.reindentlines',
    'editor.action.reindentselectedlines',
    'editor.action.smartSelect.expand',
    'editor.action.smartSelect.shrink',
    'editor.action.forceRetokenize',
    'editor.action.toggleTabFocusMode',
    'editor.action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters',
    'editor.action.unicodeHighlight.disableHighlightingOfInvisibleCharacters',
    'editor.action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters',
    'editor.action.unicodeHighlight.showExcludeOptions',
    'editor.action.wordHighlight.next',
    'editor.action.wordHighlight.prev',
    'editor.action.wordHighlight.trigger',
    'editor.emmet.action.wrapWithAbbreviation',
    'editor.emmet.action.removeTag',
    'editor.emmet.action.updateTag',
    'editor.emmet.action.matchTag',
    'editor.emmet.action.balanceIn',
    'editor.emmet.action.balanceOut',
    'editor.emmet.action.prevEditPoint',
    'editor.emmet.action.nextEditPoint',
    'editor.emmet.action.mergeLines',
    'editor.emmet.action.selectPrevItem',
    'editor.emmet.action.selectNextItem',
    'editor.emmet.action.splitJoinTag',
    'editor.emmet.action.toggleComment',
    'editor.emmet.action.evaluateMathExpression',
    'editor.emmet.action.updateImageSize',
    'editor.emmet.action.incrementNumberByOneTenth',
    'editor.emmet.action.incrementNumberByOne',
    'editor.emmet.action.incrementNumberByTen',
    'editor.emmet.action.decrementNumberByOneTenth',
    'editor.emmet.action.decrementNumberByOne',
    'editor.emmet.action.decrementNumberByTen',
    'editor.emmet.action.reflectCSSValue',
    'editor.action.clipboardCopyWithSyntaxHighlightingAction',
    'editor.action.commentLine',
    'editor.action.addCommentLine',
    'editor.action.removeCommentLine',
    'editor.action.blockComment',
    'editor.action.addSelectionToNextFindMatch',
    'editor.action.addSelectionToPreviousFindMatch',
    'editor.action.moveSelectionToNextFindMatch',
    'editor.action.moveSelectionToPreviousFindMatch',
    'editor.action.selectHighlights',
    'editor.action.changeAll',
    'editor.action.rename',
    'editor.action.transformToUppercase',
    'editor.action.transformToLowercase',
    'editor.action.transformToSnakecase',
    'editor.action.transformToTitlecase',
    'editor.action.transformToKebabcase',
    'editor.action.insertLineBefore',
    'editor.action.insertLineAfter',
    'editor.action.deleteLines',
    'editor.action.indentLines',
    'editor.action.outdentLines',
    'editor.action.duplicateSelection',
    'editor.action.copyLinesUpAction',
    'editor.action.copyLinesDownAction',
    'editor.action.moveLinesUpAction',
    'editor.action.moveLinesDownAction',
    'editor.action.sortLinesAscending',
    'editor.action.sortLinesDescending',
    'editor.action.trimTrailingWhitespace',
    'editor.action.deleteAllLeft',
    'editor.action.deleteAllRight',
    'editor.action.joinLines',
    'editor.action.transpose',
    'editor.action.toggleWordWrap',
    'editor.action.formatDocument.multiple',
    'editor.action.formatSelection.multiple',
    'dialog.ensure',
    'editor.action.diffReview.next',
    'editor.action.diffReview.prev',
    'editor.action.showContextMenu',
    'editor.action.triggerSuggest',
    'editor.action.resetSuggestSize',
    'editor.action.setSelectionAnchor',
    'editor.action.goToSelectionAnchor',
    'editor.action.selectFromAnchorToCursor',
    'editor.action.cancelSelectionAnchor',
    'editor.action.selectToBracket',
    'editor.action.jumpToBracket',
    'editor.action.moveCarretLeftAction',
    'editor.action.moveCarretRightAction',
    'editor.action.transposeLetters',
    'editor.action.quickFix',
    'editor.action.refactor',
    'editor.action.refactor.preview',
    'editor.action.sourceAction',
    'editor.action.organizeImports',
    'editor.action.autoFix',
    'editor.action.fixAll',
    'codelens.showLensesInCurrentLine',
    'editor.action.revealDefinitionAside',
    'editor.action.inlineSuggest.trigger',
    'editor.action.inlineSuggest.showNext',
    'editor.action.inlineSuggest.showPrevious',
    'editor.action.inPlaceReplace.up',
    'editor.action.inPlaceReplace.down',
    'expandLineSelection',
    'editor.action.removeDuplicateLines',
    'deleteAllLeft',
    'deleteAllRight',
    'editor.action.linkedEditing',
    'editor.action.insertCursorAbove',
    'editor.action.insertCursorBelow',
    'editor.action.insertCursorAtEndOfEachLineSelected',
    'editor.action.addCursorsToBottom',
    'editor.action.addCursorsToTop',
    'editor.action.focusNextCursor',
    'editor.action.focusPreviousCursor',
    'editor.action.gotoLine',
    'editor.toggleWordWrap',
    'editor.action.copyPath',
    'editor.action.copyRelativePath',
    'editor.action.fontZoomIn',
    'editor.action.fontZoomOut',
    'editor.action.fontZoomReset',
    'editor.tokenize.test',
    'editor.action.openLink',
  ],
  'Search and Navigation': [
    'workbench.action.gotoSymbol',
    'editor.action.startFindReplaceAction',
    'editor.actions.findWithArgs',
    'actions.findWithSelection',
    'editor.action.nextMatchFindAction',
    'editor.action.previousMatchFindAction',
    'editor.action.nextSelectionMatchFindAction',
    'editor.action.previousSelectionMatchFindAction',
    'editor.unfold',
    'editor.unfoldRecursively',
    'editor.fold',
    'editor.foldRecursively',
    'editor.foldAll',
    'editor.unfoldAll',
    'editor.foldAllBlockComments',
    'editor.foldAllMarkerRegions',
    'editor.unfoldAllMarkerRegions',
    'editor.foldAllExcept',
    'editor.unfoldAllExcept',
    'editor.toggleFold',
    'editor.gotoParentFold',
    'editor.gotoPreviousFold',
    'editor.gotoNextFold',
    'editor.createFoldingRangeFromSelection',
    'editor.removeManualFoldingRanges',
    'editor.foldLevel1',
    'editor.foldLevel2',
    'editor.foldLevel3',
    'editor.foldLevel4',
    'editor.foldLevel5',
    'editor.foldLevel6',
    'editor.foldLevel7',
    'editor.gotoLine',
    'editor.action.revealDefinition',
    'editor.action.peekDefinition',
    'editor.action.revealDeclaration',
    'editor.action.peekDeclaration',
    'editor.action.goToTypeDefinition',
    'editor.action.peekTypeDefinition',
    'editor.action.goToImplementation',
    'editor.action.peekImplementation',
    'editor.action.goToReferences',
    'editor.action.referenceSearch.trigger',
    'editor.action.showHover',
    'editor.action.marker.next',
    'editor.action.marker.prev',
    'editor.action.marker.nextInFiles',
    'editor.action.marker.prevInFiles',
    'editor.workspaceSymbol.quickopen',
    'editor.workspaceSymbolClass.quickopen',
    'content-search.openSearch',
    'search.menu.replace',
    'search.menu.replaceAll',
    'search.menu.hide',
    'search.menu.copy',
    'search.menu.copyAll',
    'search.menu.copyPath',
    'editor.action.triggerParameterHints',
    'editor.action.inlineSuggest.trigger',
    'editor.action.inlineSuggest.showNext',
    'editor.action.inlineSuggest.showPrevious',
    'actions.find',
    'deleteInsideWord',
    'editor.focusIfNotActivateElement',
    'editor.mergeEditor.reset',
    'workbench.action.gotoSymbol',
    'cursorUndo',
    'cursorRedo',
    'file-search.refresh',
    'file-search.clean',
    'output.channel.clear',
    'workspace.addFolderToWorkspace',
    'workspace.saveWorkspaceAsFile',
    'outline.collapse.all',
    'outline.follow.cursor',
    'outline.sort.kind',
    'outline.sort.name',
    'outline.sort.position',
    'walkthroughs.get.started',
    '_vscode_delegate_cmd_lowzug5h',
    '_vscode_delegate_cmd_lowzugai',
    'core.launchConfiguration.open',
    'ext.restart',
    'copyFilePath',
  ],
  'Extensions and Customization': [
    'container.show.extension',
    'extension.js-debug.prettyPrint',
    'extension.js-debug.toggleSkippingFile',
    'extension.js-debug.addCustomBreakpoints',
    'extension.js-debug.removeCustomBreakpoint',
    'extension.js-debug.removeAllCustomBreakpoints',
    'extension.pwa-node-debug.attachNodeProcess',
    'extension.js-debug.npmScript',
    'extension.js-debug.createDebuggerTerminal',
    'extension.js-debug.startProfile',
    'extension.js-debug.stopProfile',
    'extension.js-debug.revealPage',
    'extension.js-debug.debugLink',
    'extension.js-debug.createDiagnostics',
    'extension.node-debug.startWithStopOnEntry',
    'extension.js-debug.openEdgeDevTools',
    'extension.js-debug.callers.add',
    'extension.js-debug.callers.remove',
    'extension.js-debug.callers.removeAll',
    'extension.js-debug.callers.goToCaller',
    'extension.js-debug.callers.gotToTarget',
    'vscode-icons.activateIcons',
    'vscode-icons.regenerateIcons',
    'vscode-icons.ngPreset',
    'vscode-icons.nestPreset',
    'vscode-icons.jsPreset',
    'vscode-icons.tsPreset',
    'vscode-icons.jsonPreset',
    'vscode-icons.hideFoldersPreset',
    'vscode-icons.foldersAllDefaultIconPreset',
    'vscode-icons.hideExplorerArrowsPreset',
    'vscode-icons.restoreIcons',
    'vscode-icons.resetProjectDetectionDefaults',
    'workbench.action.showRuntimeExtensions',
    'workbench.action.extensionHostProfiler.start',
    'workbench.action.extensionHostProfiler.stop',
    'sumi-extension.toolbar.btn.setState',
    'sumi-extension.toolbar.btn.setContext',
    'sumi-extension.toolbar.btn.connectHandle',
    'sumi-extension.toolbar.select.setState',
    'sumi-extension.toolbar.select.setOptions',
    'sumi-extension.toolbar.select.setSelect',
    'sumi-extension.toolbar.select.connectHandle',
    'sumi-extension.toolbar.showPopover',
    'sumi-extension.toolbar.hidePopover',
  ],
  'Data Science and Notebooks': [
    'python.analysis.clearCache',
    'python.enableSourceMapSupport',
    'python.sortImports',
    'python.startREPL',
    'python.createTerminal',
    'python.buildWorkspaceSymbols',
    'python.openTestNodeInEditor',
    'python.runTestNode',
    'python.debugTestNode',
    'python.runtests',
    'python.debugtests',
    'python.execInTerminal',
    'python.execInTerminal-icon',
    'python.setInterpreter',
    'python.switchOffInsidersChannel',
    'python.switchToDailyChannel',
    'python.switchToWeeklyChannel',
    'python.refactorExtractVariable',
    'python.refactorExtractMethod',
    'python.viewTestOutput',
    'python.viewLanguageServerOutput',
    'python.viewOutput',
    'python.selectAndRunTestMethod',
    'python.selectAndDebugTestMethod',
    'python.selectAndRunTestFile',
    'python.runCurrentTestFile',
    'python.runFailedTests',
    'python.discoverTests',
    'python.discoveringTests',
    'python.stopTests',
    'python.configureTests',
    'python.execSelectionInTerminal',
    'python.execSelectionInDjangoShell',
    'python.goToPythonObject',
    'python.setLinter',
    'python.enableLinting',
    'python.runLinting',
  ],
  'Accessibility and Help': [
    'editor.action.showAccessibilityHelp',
    'editor.action.inspectTokens',
    'editor.action.showHover',
    'editor.action.showDefinitionPreviewHover',
    'core.about',
    'core.keymaps.open',
    'keymaps.open.source',
    'keyboard.chooseKeyboardLayout',
    'ai.explain.terminal',
    'ai.explain.debug',
    'authentication.noAccounts',
    'preference.open.user',
    'preference.open.workspace',
    'preference.open.source',
    'core.openpreference',
    'variable.list',
  ],
};

@Injectable()
export class AiSumiService {
  private commandGroups = InnerCommandGroups;
  // for split command, too much will out of prompt tokens
  protected commandRequestStep = 50;

  @Autowired(AiBackSerivcePath)
  aiBackService: IAiBackService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(CommandRegistry)
  protected readonly commandRegistryService: CommandRegistry;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  @Autowired(IFileServiceClient)
  protected fileService: IFileServiceClient;

  @Autowired(SumiCommandPromptManager)
  protected promptManager: SumiCommandPromptManager;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  protected logger: ILogServiceClient;
  // 用来记录查找失败的，因为用 any，在 catch 里不好处理，加个变量记录下
  private findCommandRequestErrorCode = 0;

  constructor() {
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
  }

  async requestToModel(prompt: string, model?: string) {
    return this.aiBackService.request(prompt, { model });
  }

  async classifyCommand() {
    const allCommand = this.commandRegistryService
      .getCommands()
      .filter((command) => command.labelLocalized?.localized || command.label);
    const innerCommands = Object.keys(this.commandGroups).reduce(
      (array, curGroup) => array.concat(this.commandGroups[curGroup]),
      [] as string[],
    );
    const unGroupCommands = differenceWith(
      allCommand,
      innerCommands,
      (command, innerCommand) => command.id === innerCommand,
    );

    if (unGroupCommands.length) {
      const partCommands = Array.from(
        { length: Math.round(unGroupCommands.length / this.commandRequestStep) || 1 },
        (_, index) => index,
      ).map((i) => unGroupCommands.slice(i * this.commandRequestStep, (i + 1) * this.commandRequestStep));

      for (const commands of partCommands) {
        await this.requestForClassifyCommand(commands);
      }
    }
  }

  async requestForClassifyCommand(commands: Command[]) {
    const prompt = this.promptManager.groupCommand(commands.map((c) => c.id).join(','));
    const groupReply = await this.requestToModel(prompt);

    const groupReg = new RegExp(
      `\\[(?<groupName>${Object.keys(this.commandGroups).join('|')})\\]:\\s?(?<commandList>.*)`,
    );

    const groupArray = groupReply.data?.split('\n') || [];
    groupArray.forEach((groupLine) => {
      const match = groupReg.exec(groupLine);
      if (match && match.groups?.commandList) {
        const { groupName, commandList } = match.groups || {};
        const commandArray = commandList.split(',');
        this.commandGroups[groupName] = this.commandGroups[groupName]
          ? this.commandGroups[groupName].concat(commandArray)
          : [commandArray];
      }
    });
  }

  public async searchCommand(input: string): Promise<IAiBackServiceResponse<Command>> {
    this.findCommandRequestErrorCode = 0;

    const command = this.searchWithoutAI(input);
    if (command) {
      return { data: command };
    }

    try {
      return this.searchGroup(input);
    } catch {
      return { errorCode: 1 };
    }
  }

  private searchWithoutAI(input: string) {
    return this.commandRegistryService
      .getCommands()
      .find((command) => command.labelLocalized?.localized === input || command.label === input);
  }

  public async searchGroup(input: string) {
    const enPrompt = this.promptManager.searchGroup(input, { useCot: true });

    const groupReply = await this.requestToModel(enPrompt);

    if (groupReply?.errorCode) {
      return { errorCode: groupReply.errorCode, errorMsg: groupReply.errorMsg };
    }

    const groups = Object.keys(this.commandGroups);
    const groupReg = new RegExp(`(?<group>${groups.join('|')})`);
    const match = groupReg.exec(groupReply.data || '');
    const group = match && match.groups?.group;

    return this.findCommand(input, group);
  }

  public async findCommand(input: string, group?: string | null): Promise<IAiBackServiceResponse<Command>> {
    const commandsInGroup = this.commandGroups[group || ''];

    if (!commandsInGroup) {
      return { errorCode: 0 };
    }

    const commands = this.commandRegistryService
      .getCommands()
      .filter((c) => commandsInGroup.includes(c.id) || commandsInGroup.includes(c.delegate));

    const partCommands = Array.from(
      { length: Math.round(commands.length / this.commandRequestStep) },
      (_, index) => index,
    ).map((i) => commands.slice(i * this.commandRequestStep, (i + 1) * this.commandRequestStep));

    try {
      const command = await Promise.any(partCommands.map((c) => this.requestCommand(c, input)));

      return { data: commands.find((c) => c.id === command?.data) };
    } catch (e) {
      this.logger.error('Find command failed: ', e.message);
      return { errorCode: this.findCommandRequestErrorCode };
    }
  }

  private async requestCommand(commands: Command[], question: string) {
    const prompt = this.promptManager.findCommand({
      commands: commands.map((c) => `{${c.id}}-{${c.labelLocalized?.localized! || c.label || ''}}`).join('\n'),
      question,
    });

    const commandReply = await this.requestToModel(prompt);

    if (commandReply.errorCode) {
      this.findCommandRequestErrorCode = commandReply.errorCode;
    }

    const answerCommand = this.matchCommand(commandReply.data || '');

    if (answerCommand && commands.find((c) => c.id === answerCommand)) {
      return { data: answerCommand };
    }

    await Promise.reject('Command not found');
  }

  private matchCommand(answer: string): string {
    const commandReg = /`(?<command>\S+)`/;
    const command = commandReg.exec(answer);

    return command?.groups?.command || '';
  }
}
