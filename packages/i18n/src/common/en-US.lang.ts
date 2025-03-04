import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';

import { browserViews } from './contributes/en-US.lang';
import { editorLocalizations } from './editor/en-US';
import { enUS as mergeConflicts } from './merge-conflicts/en-US.lang';

export const localizationBundle = {
  languageId: LOCALE_TYPES.EN_US,
  languageName: 'english',
  localizedLanguageName: 'English',
  contents: {
    ButtonAllow: 'Allow',
    ButtonOK: 'Confirm',
    ButtonCancel: 'Cancel',
    extension: 'Extension',
    'common.yes': 'Yes',
    'common.no': 'No',
    editTtile: 'Edit',
    'common.loading': 'Loading...',

    'tree.filter.placeholder': 'Enter a keyword or path to filter',

    'file.new': 'New File',
    'file.folder.new': 'New Folder',
    'file.locate': 'Locate File',

    'file.save': 'Save File',
    'file.saveAll': 'Save All',
    'file.autoSave': 'Auto Save',
    'file.open': 'Open',
    'file.open.side': 'Open to the Side',
    'file.open.type': 'Open With...',
    'file.open.type.placeholder': 'Select editor for "{0}"',
    'file.open.type.detail.active': 'Active',
    'file.open.type.detail.and': 'and',
    'file.open.type.detail.default': 'Default',
    'file.open.type.preference.default': 'Configure default editor for "{0}"...',
    'file.delete': 'Delete',
    'file.compare': 'Compare with Current File',
    'file.rename': 'Rename',
    'file.close': 'Close',
    'file.copy.path': 'Copy Path',
    'file.copy.relativepath': 'Copy Relative Path',
    'file.paste.file': 'Paste',
    'file.copy.file': 'Copy',
    'file.cut.file': 'Cut',
    'file.location': 'Locate in Files Explorer',
    'file.action.new.file': 'New File',
    'file.action.new.folder': 'New Folder',
    'file.action.refresh': 'Refresh',
    'file.open.folder': 'Open Folder',
    'file.open.workspace': 'Open Workspace from File ...',
    'file.action.collapse': 'Collapse',
    'file.confirm.delete': '### Are you sure you want to delete the following {0} files?  \n{1}',
    'file.confirm.deleteTips': 'You can restore files from the Trash',
    'file.confirm.moveToTrash.ok': 'Move to trash',
    'file.confirm.delete.ok': 'Delete',
    'file.confirm.delete.cancel': 'Cancel',
    'file.confirm.move': 'Are you sure you want to move file {0} to {1}?',
    'file.confirm.move.ok': 'Move',
    'file.confirm.move.cancel': 'Cancel',
    'file.confirm.paste': 'Are you sure you want to paste the file {0} to {1} ?',
    'file.confirm.paste.ok': 'Paste',
    'file.confirm.paste.cancel': 'Cancel',
    'file.confirm.replace': 'Are you sure you want to replace file {0}?',
    'file.confirm.replace.ok': 'Replace',
    'file.confirm.replace.cancel': 'Cancel',
    'file.move.existMessage':
      'The file to be pasted is deleted or moved at the same time. Unable to move/copy. The file already exists at the target location.',
    'file.empty.defaultTitle': 'No Open Folder',
    'file.empty.defaultMessage': 'The folder has not been opened yet',
    'file.workspace.defaultTip': 'Untitled (WORKSPACE)',
    'file.workspace.defaultWorkspaceTip': '{0} (WORKSPACE)',
    'file.empty.openFolder': 'Open Folder',
    'file.collapse': 'Collapse All',
    'file.refresh': 'Refresh',
    'file.search.folder': 'Search on this folder',
    'file.focus.files': 'Focus on Files Explorer',
    'file.filetree.filter': 'Filter on opened files',
    'file.filetree.openTerminalWithPath': 'Open In Integrated Terminal',
    'file.tooltip.symbolicLink': 'Symbolic Link',
    'file.resource-deleted': '(Deleted)',
    'file.revealInExplorer': 'Reveal in File Tree',

    'menu-bar.title.file': 'File',
    'menu-bar.title.edit': 'Edit',
    'menu-bar.title.selection': 'Selection',
    'menu-bar.title.view': 'View',
    'menu-bar.title.go': 'Go',
    'menu-bar.title.debug': 'Debug',
    'menu-bar.title.terminal': 'Terminal',
    'menu-bar.title.window': 'Window',
    'menu-bar.title.help': 'Help',

    'menu-bar.file.save-as': 'Save As',
    'menu-bar.file.save-all': 'Save All',
    'menu-bar.file.open': 'Open File',
    'menu-bar.view.quick.command': 'Command Palette...',

    'menu-bar.go.jumpToBracket': 'Go to Bracket',
    'menu-bar.go.nextProblemInFiles': 'Next Problem',
    'menu-bar.go.prevProblemInFiles': 'Previous Problem',

    'menu-bar.file.pref': 'Preference',
    'menu-bar.mode.compact': 'Compact Mode',

    editor: 'Editor',
    'editor.undo': 'Undo',
    'editor.redo': 'Redo',
    'editor.saveAll': 'Save All',
    'editor.saveCurrent': 'Save Current File',
    'editor.saveCodeActions.getting': 'Getting code actions from {0}.',
    'editor.saveCodeActions.saving': 'Saving "{0}"',
    'editor.title.context.close': 'Close',
    'editor.closeTab.title': 'Close ({0})',
    'editor.closeCurrent': 'Close Current Editor',
    'editor.openExternal': 'Open Externally',
    'editor.cannotOpenBinary': 'The file is not displayed in the text editor because it is binary.',
    'editor.splitToLeft': 'Split To Left',
    'editor.splitToRight': 'Split To Right',
    'editor.splitToTop': 'Split To Top',
    'editor.splitToBottom': 'Split To Bottom',
    'editor.closeAllInGroup': 'Close All',
    'editor.closeToRight': 'Close To Right',
    'editor.closeSaved': 'Close Saved',
    'editor.cannotSaveWithoutDirectory': 'Cannot save file without directory',
    'editor.action.accept': 'Accept Changes (Use version on the right)',
    'editor.action.revert': 'Revert Changes (Use version on the left)',
    'editor.format.chooseFormatter': 'Choose the Formatter',
    'editor.formatDocument.label.multiple': 'Format Document With...',
    'editor.formatSelection.label.multiple': 'Format Selection With...',
    'editor.chooseEncoding': 'Reopen with encoding (Unsaved Changes will be lost)',
    'editor.guessEncodingFromContent': 'Guess from content',
    'editor.changeEol': 'Select End Of Line Sequence',
    'editor.failToOpen': 'Failed to open {0}. Error message: {1}',
    'editor.changeLanguageId': 'Select Language Mode',
    'editor.lineHeight': 'Line Height',
    'editor.lineHeight.description':
      'Controls the line height.\r\nUse 0 to automatically compute the line height from the font size.\r\nValues between 0 and 8 will be used as a multiplier with the font size.\r\nValues greater than or equal to 8 will be used as effective values.',
    'status-bar.label.line': 'Ln',
    'status-bar.label.column': 'Col',
    'status-bar.label.selected': 'Selected',
    'status-bar.label.tabType.space': 'Spaces',
    'status-bar.label.tabType.tab': 'Tab Size',
    'status-bar.scm': 'Source Control',
    'status-bar.editor-selection': 'Editor Selection',
    'status-bar.editor-language': 'Editor Language',
    'status-bar.editor-encoding': 'Editor Encoding',
    'status-bar.editor-space': 'Editor Space',
    'status-bar.editor-eol': 'Editor End Of Line',
    'status-bar.editor-indentation': 'Editor Indentation',
    'status-bar.editor-langStatus': 'Editor Language Status',
    'editor.closeOtherEditors': 'Close Others',
    'status.editor.chooseLanguage': 'Choose Language Mode',
    'status.editor.goToLineCol': 'Go to Line/Column',
    'status.editor.chooseEncoding': 'Choose Encoding',
    'status.editor.changeEol': 'Select End Of Line Sequence',

    'edit.cut': 'Cut',
    'edit.copy': 'Copy',
    'edit.paste': 'Paste',
    'edit.selectAll': 'Select All',
    'editor.copyPath': 'Copy Path',
    'editor.copyRelativePath': 'Copy Relative Path',

    'editor.goBack': 'Back',
    'editor.goForward': 'Forward',
    'editor.quickOpen': 'Go to File...',
    'editor.editor.goToSymbol': 'Go to Symbol...',
    'editor.goToLine': 'Go to Line...',
    'editor.openType': 'Open Type',

    'editor.closeEditorsInOtherGroups': 'Close Other Groups',
    'editor.resetEditorGroups': 'Reset Editor Group',
    'editor.revert': 'Revert Document',

    'editor.tokenize.test': 'Try Tokenize First Selection',

    'quickopen.goToLine.defaultMessage':
      'Current Line: {0}, Character: {1}. Type a line number between 1 and {2} to navigate to.',
    'quickopen.goToLine.notValid': 'Not A valid Editor',
    'quickopen.goToLine.lineInfo': 'Go To Line {0}',
    'quickopen.goToLine.colInfo': ' and Character {0}',
    'quickopen.goToLine.desc': 'Go to Line...',

    'quickopen.command.placeholder': 'Placeholder',
    'quickopen.command.description': 'Run IDE Command',
    'quickopen.command.nohandler': 'Cannot Find Anymore',
    'quickopen.quickinput.prompt': "Press 'Enter' to confirm or 'Escape' to cancel",
    'quickopen.tab.file': 'File',
    'quickopen.tab.class': 'Class',
    'quickopen.tab.symbol': 'Symbol',
    'quickopen.tab.command': 'Command',
    'quickopen.tab.goToLine': 'Go To Line',
    'quickopen.tab.tip.prefix': 'Press',
    'quickopen.tab.tip.suffix': 'to switch',
    'quickOpen.openOnTheRightSide': 'Open on the side',

    'explorer.title': 'Explorer',
    'explorer.electron.revealInFinder': 'Reveal In Explorer',
    'explorer.electron.openInSystemTerminal': 'Open In Terminal',
    'explorer.electron.openInSystemTerminal.error': 'Open {0} In Terminal Fail: {1}',

    'search.title': 'Search',
    'search.input.placeholder': 'Enter search content',
    'search.input.title': 'Search',
    'search.replace.title': 'Replace',
    'search.input.checkbox': 'Display search rules',
    'file-search.command.fileOpen.description': 'Open File',
    'file-search.command.fileOpen.placeholder': 'Search File By Name(Append : To Go to Line or @ To Go to Symbol)',
    'search.includes': 'Files to include',
    'search.includes.description': 'Enter the file name or folder name, multiple separated by ","',
    'search.excludes': 'Files to exclude',
    'search.excludes.default.enable': 'Enable default exclusions',
    'search.replaceAll.label': 'Replace All',
    'search.replace.label': 'Replace',
    'search.files.result': '{0} results found in {1} files',
    'search.CollapseDeepestExpandedLevelAction.label': 'Collapse All',
    'search.ExpandDeepestExpandedLevelAction.label': 'Expand All',
    'search.ClearSearchResultsAction.label': 'Clear Search Results',
    'search.RefreshAction.label': 'Refresh',
    'search.removeAll.occurrences.files.confirmation.message': 'Are you sure to replace {0} of the {1} files',
    'search.removeAll.occurrences.file.confirmation.message': 'Are you sure to replace the {0} results in this file?',
    'search.result.hide': 'Hide',
    'search.menu.copyAll': 'Copy All',
    'search.help.showIncludeRule': 'View syntax rules',
    'search.help.supportRule': 'Support the following syntax rules:',
    'search.help.excludeList': 'Excluded items include:',
    'search.help.concatRule': 'Multiple conditional separation',
    'search.help.matchOneOrMoreRule': 'To match one or more characters in a path segment',
    'search.help.matchOne': 'To match on one character in a path segment',
    'search.help.matchAny': 'To match any number of path segments, including none',
    'search.help.matchWithGroup': 'To group conditions',
    'search.help.matchRange': 'To declare a range of characters to match',
    'search.help.modify': 'Modify',
    'search.replace.buttonOK': 'Replace',
    'search.replace.buttonCancel': 'Cancel',
    'search.too.many.results': 'Because your search terms are too loose, we only show some search results',
    'search.fileReplaceChanges': '{0} ↔ {1} (Replace Preview)',
    'search.fileResults': 'File results',
    'search.fileResults.notfound': 'No files matching',
    'search.fileSymbolResults': 'symbols ({0})',
    'search.fileSymbolResults.notfound': 'No symbols matching',
    'search.historyMatches': 'Recently Opened',
    'search.replaceAll.occurrencesMessage': "Replaced {0} occurrences across {1} files with '{2}'.",
    'search.replace.toggle.button.title': 'Toggle Replace',
    'search.caseDescription': 'Match Case',
    'search.wordsDescription': 'Match Whole Word',
    'search.regexDescription': 'Use Regular Expression',
    'search.includeIgnoredFiles': 'Include Ignored Files',
    'search.onlyOpenEditors': 'Search only in Open Editors',
    'search.noResultsFound': 'No results found. Review your settings for configured exclusions and ignore files',

    'quickopen.recent-commands': 'recently used',
    'quickopen.other-commands': 'other commands',
    'quickopen.commands.notfound': 'No commands matchings',
    mSelection: 'Selection',
    'selection.all': 'Select All',

    'dialog.confirm': 'confirm',
    'dialog.file.name': 'File Name',
    'dialog.file.title': 'Select Directory:',
    'dialog.file.openLabel': 'Open File:',
    'dialog.file.saveLabel': 'Save File:',
    'dialog.file.close': 'Close',
    'dialog.file.ok': 'OK',
    'dialog.ensure': 'OK',

    'editorOpenType.code': 'Code',
    'editorOpenType.preview': 'Preview',

    'scm.title': 'Source Control',
    'scm.action.git.refresh': 'Refresh',
    'scm.action.git.commit': 'Commit',
    'scm.action.git.more': 'More Actions',
    'scm.statusbar.repo': 'Repo',
    'scm.provider.title': 'Source Control Providers',
    'scm.provider.empty': 'No source control providers registered.',
    'scm.provider.init': 'Click to initialize a repository',
    'scm.diff.change.next': 'Next Change',
    'scm.diff.change.previous': 'Previous Change',
    'scm.diff.toggle.renderSideBySide': 'Toggle Inline View',
    'scm.dirtyDiff.changes': '{0} of {1} changes',

    'debug.action.add.smartAddConfiguration': 'Smart Add Configuration',
    'debug.action.add.configuration': 'Add Configuration',
    'debug.action.edit.configuration': 'Edit Configuration',
    'debug.action.open.launch.editor': 'Open Launch Editor UI',
    'debug.action.no.configuration': 'No Configurations',
    'debug.action.start': 'Start Debugging',
    'debug.action.open.configuration': 'Open launch.json',
    'debug.action.debug.console': 'Debug Console',
    'debug.action.step-into': 'Step Into',
    'debug.action.step-over': 'Step Over',
    'debug.action.step-out': 'Step Out',
    'debug.action.restart': 'Restart',
    'debug.action.pause': 'Pause',
    'debug.action.stop': 'Stop',
    'debug.action.disattach': 'Disattach',
    'debug.action.runToCursor': 'Run to Cursor',
    'debug.action.forceRunToCursor': 'Force Run to Cursor',
    'debug.breakpoint.toggle': 'Enable/Disable Breakpoints',
    'debug.breakpoint.removeAll': 'Remove All Breakpoints',
    'debug.breakpoint.uncaughtExceptions': 'Uncaught Exceptions',
    'debug.breakpoint.allExceptions': 'All Exceptions',
    'debug.watch.removeAll': 'Remove All Expression',
    'debug.watch.collapseAll': 'Collapse All Expression',
    'debug.watch.add': 'Add Expression',
    'debug.watch.notAvailable': 'not available',
    'debug.watch.edit': 'Edit Expression',
    'debug.watch.copyValue': 'Copy Value',
    'debug.watch.remove': 'Remove Expression',
    'debug.action.continue': 'Continue',
    'debug.console.panel.title': 'Debug Console',
    'debug.console.panel.default': 'default',
    'debug.console.filter.placeholder': 'Filter (e.g. text, !exclude)',
    'debug.console.clear': 'Clear',
    'debug.console.copy': 'Copy',
    'debug.console.copyAll': 'Copy All',
    'debug.console.collapseAll': 'Collapse All',
    'debug.console.followLink': '{0} + click to follow link',
    'debug.console.input.placeholder': 'Please start a debug session to evaluate expressions',
    'debug.console.errorMessage': 'Debug session initialization failed. See console for details.',
    'debug.console.consoleCleared': 'Console was cleared',
    'debug.notSupported.type': 'Debug type "{0}" is not supported, please check your launch config.',
    'debug.notSupported.any': 'Debug is not supported, please check your launch config.',

    'debug.stack.loadMore': 'Load All Stack Frames',
    'debug.stack.loading': 'Loading...',
    'debug.stack.showMoreAndOrigin': 'Show {0} More: {1}',
    'debug.breakpoint.deactive': 'Deactivate Breakpoints',
    'debug.breakpoint.active': 'Activate Breakpoints',
    'debug.threads.title': 'THREADS',
    'debug.watch.title': 'WATCH',
    'debug.callStack.title': 'CALL STACK',
    'debug.variables.title': 'VARIABLES',
    'debug.variables.view.memory': 'View Binary Data',
    'debug.variables.view.memory.prompt.hexEditor.notInstalled':
      'Inspecting binary data requires the Hex Editor extension.',
    'debug.breakpoints.title': 'BREAKPOINTS',
    'debug.container.title': 'Debug',
    'debug.breakpoint.breakpointMessage': 'Breakpoint',
    'debug.breakpoint.logpointMessage': 'Logpoint',
    'debug.breakpoint.conditionalMessage': 'Conditional Breakpoint',
    'debug.breakpoint.unverified': 'Unverified ',
    'debug.breakpoint.disabled': 'Disabled ',
    'debug.breakpoint.blank': 'Blank',
    'debug.configuration.selectAutomaticDebugTypesHint': 'Automatic Configuration',
    'debug.configuration.selectAutomaticDebugTypes': 'Select a Debug Type',
    'debug.configuration.selectAutomaticDebugConfiguration': 'Select a DebugConfiguration',
    'debug.configuration.comment1': 'Use IntelliSense to learn about possible attributes.',
    'debug.configuration.comment2': 'Hover to view descriptions of existing attributes.',
    'debug.configuration.comment3': 'For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387',
    'debug.launch.existed': 'Debug configuration "{0}" is already running',
    'debug.expression.log.placeholder':
      'Message to log when breakpoint is hit. Expressions within {} are interpolated. Press "Enter" to confirm and "Esc" to cancel.',
    'debug.expression.hit.placeholder':
      'Break when hit count condition is met. Press "Enter" to confirm and "Esc" to cancel.',
    'debug.expression.condition.placeholder':
      'Break when the expression evaluates to true. Press "Enter" to confirm and "Esc" to cancel.',
    'debug.expression.condition': 'Expression',
    'debug.expression.hitCondition': 'Hit Count',
    'debug.expression.logMessage': 'Log Message',
    'debug.menu.delete.breakpoint': 'Delete Breakpoint',
    'debug.menu.edit.breakpoint': 'Edit Breakpoint',
    'debug.menu.disable.breakpoint': 'Disable Breakpoint',
    'debug.menu.enable.breakpoint': 'Enable Breakpoint',
    'debug.menu.add.logpoint': 'Add Log breakpoint',
    'debug.menu.add.conditional': 'Add Condition Breakpoint',
    'debug.menu.add.breakpoint': 'Add Breakpoint',
    'debug.menu.disable.logpoint': 'Disable Log Breakpoint',
    'debug.menu.title.run': 'Run or Debug...',
    'debug.stack.frame.noSource': 'Unknown',
    'debug.stack.frame.because': 'Because Of',
    'debug.stack.frame.stopped': 'Stopped',
    'debug.stack.frame.running': 'Running',
    'debug.launch.configurations.debugType': 'Type of configuration.',
    'debug.launch.configurations.debugTypeNotRecognised':
      'The debug type is not recognized. Make sure that you have a corresponding debug extension installed and that it is enabled.',
    'debug.launch.configurations.node2NotSupported':
      '"node2" is no longer supported, use "node" instead and set the "protocol" attribute to "inspector".',
    'debug.launch.configurations.debugName':
      'Name of configuration; appears in the launch configuration drop down menu.',
    'debug.launch.configurations.debugRequest': 'Request type of configuration. Can be "launch" or "attach".',
    'debug.launch.configurations.debugServer':
      'For debug extension development only: if a port is specified VS Code tries to connect to a debug adapter running in server mode',
    'debug.launch.configurations.debugPrelaunchTask': 'Task to run before debug session starts.',
    'debug.launch.configurations.debugPostDebugTask': 'Task to run after debug session ends.',
    'debug.launch.configurations.debugWindowsConfiguration': 'Windows specific launch configuration attributes.',
    'debug.launch.configurations.debugOSXConfiguration': 'OS X specific launch configuration attributes.',
    'debug.launch.configurations.debugLinuxConfiguration': 'Linux specific launch configuration attributes.',
    'debug.launch.typeNotSupported': 'The debug session type "{0}" is not supported.',
    'debug.launch.catchError': 'There was an error starting the debug session, check the logs for more details.',
    'debug.launch.view.template.button.addItem': 'Add items',
    'debug.launch.view.template.input.placeholder': 'Please enter {0}',
    'debug.launch.view.template.button.submit': 'Add new configuration item',
    'debug.launch.view.edit.inLaunchJson': 'Edit in launch.json',

    'debug.widget.exception.thrownWithId': 'Exception has occurred: {0}',
    'debug.widget.exception.thrown': 'Exception has occurred.',

    'output.tabbar.title': 'Output',
    'output.channel.none': '<no output yet>',
    'output.configurationTitle': 'Output settings',
    'output.logWhenNoPanel': 'Whether to output to the browser when no available panel',
    'output.maxChannelLine': 'Max channel message line length',
    'output.maxChannelLineDesc': 'Max channel message line length',
    'output.enableLogHighlight': 'Enable/disable Log Highlight',
    'output.enableLogHighlightDesc': 'Use Log language to tokenization log text, vscode-log extension is required',
    'output.enableSmartScroll': 'Enable/disable Smart scrolling',
    'output.enableSmartScrollDesc':
      'Smart scrolling allows you to lock scrolling automatically when you click in the output view and unlocks when you click in the last line.',

    'preference.menubar.mode.compact': 'Controls whether the menu bar uses compact mode',

    'preference.explorer.confirm.delete':
      'Controls whether the explorer should ask for confirmation when deleting a file via trash',
    'preference.explorer.confirm.move': 'Controls whether the explorer should ask for confirmation when moving a file',
    'preference.files.watcherExclude':
      'Configure glob patterns of file paths to exclude from file watching. Patterns must match on absolute paths (i.e. prefix with ** or the full path to match properly). Changing this setting requires a restart. When you experience Code consuming lots of cpu time on startup, you can exclude large folders to reduce the initial load.',
    'preference.files.exclude':
      'Configure glob patterns for excluding files and folders. For example, the files explorer decides which files and folders to show or hide based on this setting.',
    'preference.search.exclude':
      'Configure glob patterns for excluding files and folders in searches. Inherits all glob patterns from the `#files.exclude#` setting.',
    'preference.search.include': 'Configure glob patterns for including files and folders in searches.',
    'preference.files.watcherExclude.title': 'Exclusion file watch `files.watcherExclude`',
    'preference.search.exclude.title': 'Search exclusion file `search.exclude`',
    'preference.search.useReplacePreview':
      'Controls whether to open Replace Preview when selecting or replacing a match.',
    'preference.search.searchOnType': 'Controls whether to search as you type',
    'preference.search.searchOnTypeDebouncePeriod':
      'Controls the debounce period of search as you type in milliseconds.',
    'preference.files.exclude.title': 'Exclude file display `files.exclude`',
    'preference.array.additem': 'Add',
    'preference.files.associations.title': 'File Association',
    'preference.files.associations':
      'Configure file associations to languages (e.g. "*.extension": "html"). These have precedence over the default associations of the languages installed.',
    'preference.files.encoding.title': 'File Encoding',
    'preference.files.encoding': 'The default character set encoding to use when reading and writing files.',
    'preference.files.autoGuessEncoding':
      'When enabled, the editor will attempt to guess the character set encoding when opening files. This setting can also be configured per language.',
    'preference.files.autoGuessEncoding.title': 'Auto Guess Encoding',
    'preference.explorer.fileTree.indent.title': 'Explorer: FileTree Indent',
    'preference.explorer.fileTree.baseIndent.title': 'Explorer: FileTree BaseIndent',
    'preference.explorer.compactFolders.title': 'Explorer: Compact Mode',
    'preference.explorer.compactFolders':
      'Controls whether the explorer should render folders in a compact form. In such a form, single child folders will be compressed in a combined tree element. Useful for Java package structures, for example.',
    'preference.explorer.autoReveal':
      'Controls whether the explorer should automatically reveal and select files when opening them.',
    'preference.editorTitle.openSource': 'Open Setting (JSON)',
    'preference.editorTitle.openUserSource': 'Open User Setting (JSON)',
    'preference.editorTitle.openWorkspaceSource': 'Open Workspace Setting (JSON)',
    'preference.editorTitle.openPreference': 'Open Setting',
    'preference.view.saveLayoutWithWorkspace.title': 'Controls whether the layout should bind with workspace',
    'preference.stringArray.operate.delete': 'Delete',
    'preference.stringArray.operate.edit': 'Edit',
    'preference.stringArray.operate.editTip': 'Press ↲',
    'preference.stringArray.none': 'None',

    // Default value prompt message for enumerated options in settings
    'preference.enum.default': 'Default',

    // Terminal
    'preference.terminal.type': 'Default Shell Type',
    'preference.terminal.typeDesc': 'To change the default type of create a new terminal',
    'preference.terminal.fontFamily': 'Terminal > Font Family',
    'preference.terminal.fontSize': 'Terminal > Font Size',
    'preference.terminal.fontWeight': 'Terminal > Font Weight',
    'preference.terminal.lineHeight': 'Terminal > Line Height',
    'preference.terminal.cursorBlink': 'Terminal > Cursor Blink',
    'preference.terminal.scrollback': 'Terminal > Cursor Scrollback',
    'preference.terminal.integrated.shellArgs.linux': 'Terminal > Shell Args Linux',
    'preference.terminal.integrated.shellArgs.linuxDesc':
      'The command line arguments to use when on the Linux terminal. ',

    'preference.terminal.integrated.copyOnSelection': 'Terminal > Copy On Selection',
    'preference.terminal.integrated.copyOnSelectionDesc':
      'Controls whether text selected in the terminal will be copied to the clipboard.',
    // Local Echo
    'preference.terminal.integrated.localEchoEnabled': 'Terminal > Local Echo',
    'preference.terminal.integrated.localEchoDesc': 'When local echo should be enabled.',
    'preference.terminal.integrated.localEchoLatencyThreshold': 'Local Echo Latency Threshold',
    'preference.terminal.integrated.localEchoLatencyThresholdDesc':
      "Length of network delay, in milliseconds, where local edits will be echoed on the terminal without waiting for server acknowledgement. If '0', local echo will always be on, and if '-1' it will be disabled.",
    'preference.terminal.integrated.localEchoExcludePrograms': 'Local Echo Exclude Programs',
    'preference.terminal.integrated.localEchoExcludeProgramsDesc':
      'Local echo will be disabled when any of these program names are found in the terminal title.',
    'preference.terminal.integrated.localEchoStyle': 'Local Echo Style',
    'preference.terminal.integrated.localEchoStyleDesc':
      'Terminal style of locally echoed text; either a font style or an RGB color.',
    'preference.terminal.integrated.xtermRenderType': 'Xterm Render Type',
    'preference.terminal.integrated.xtermRenderTypeDesc':
      'Choose Xterm render type, Webgl for better performance, Canvas better compatibility',
    'preference.terminal.integrated.enablePersistentSessionDesc':
      'Persist terminal sessions/history for the workspace across window reloads.',
    'preference.terminal.integrated.cursorStyle': 'Terminal > Cursor Style',
    'preference.terminal.integrated.cursorStyleDesc': 'Control the style of terminal cursor',
    'common.preference.open': 'Settings',
    'common.keymaps.open': 'Keyboard Shortcut',
    'common.about': 'About',
    'common.find': 'Find',
    'common.replace': 'Replace',
    'common.remoteMode': 'Remote Mode',

    'component.message.origin': 'Origin',

    'component.modal.okText': 'OK',
    'component.modal.cancelText': 'Cancel',
    'component.modal.justOkText': 'OK',

    'preference.tab.user': 'User',
    'preference.tab.workspace': 'Workspace',

    'settings.group.general': 'General',
    'settings.group.shortcut': 'Shortcut',
    'settings.group.editor': 'Editor',
    'settings.group.extension': 'Extensions',
    'settings.group.feature': 'Feature',
    'settings.group.view': 'View',
    'settings.group.terminal': 'Terminal',

    'preference.general.theme': 'Theme',
    'preference.general.icon': 'File Icon Theme',
    'preference.general.productIconTheme': 'Product Icon Theme',
    'preference.workbench.colorCustomizations': 'Overwrite colors of current color theme',
    'preference.general.language': 'Language',
    'preference.general.language.change.refresh.info':
      'After changing the language, it should be restarted to take effect. Will it be refreshed immediately?',
    'preference.general.language.change.refresh.now': 'Refresh',
    'preference.general.language.change.refresh.later': 'Later',

    'preference.debug.internalConsoleOptions': 'Controls when the internal debug console should open.',
    'preference.debug.openDebug': 'Controls when the debug view should open.',
    'preference.debug.debugViewLocation': 'Controls the location of the debug view.',
    'preference.debug.trace': 'Enable/disable tracing communications with debug adapters.',
    'preference.debug.allowBreakpointsEverywhere': 'Allow setting breakpoints in any file.',
    'preference.debug.toolbar.float.title': 'Run And Debug: Float Mode',
    'preference.debug.toolbar.float': 'Float mode',
    'preference.debug.console.filter.mode': 'Debug console filter mode',
    'preference.debug.console.filter.mode.filter': 'filter',
    'preference.debug.console.filter.mode.matcher': 'matcher',
    'preference.debug.console.wordWrap': 'Controls if the lines should wrap in the debug console.',
    'preference.debug.inline.values': 'Show variable values inline in editor while debugging.',
    'preference.debug.breakpoint.editorHint':
      'After enabling, there will be a background color blinking prompt when clicking on the breakpoint list to jump to the editor.',
    'preference.debug.breakpoint.showBreakpointsInOverviewRuler':
      'Controls whether breakpoints should be shown in the overview ruler.',

    // workbench
    'preference.workbench.refactoringChanges.showPreviewStrategy':
      'Show preview confirm when triggering some refactoring changes',
    'preference.workbench.refactoringChanges.showPreviewStrategy.title': 'Refactor Confirm',
    'preference.tab.name': 'Settings',
    'preference.noResults': "No Setting Found Containing '{0}'",
    'preference.empty': 'Loading Settings...',
    'preference.editSettingsJson': 'Edit in settings.json',
    'preference.overwritten': '(Overwritten by next scope)',
    'preference.overwrittenInUser': '(Modified in User Settings)',
    'preference.overwrittenInWorkspace': '(Modified in Workspace Settings)',
    'preference.searchPlaceholder': 'Search Settings...',
    'preference.editor.formatOnSave': 'Enable format on manual save.',
    'preference.editor.formatOnSaveTimeout':
      'Timeout in milliseconds after which the formatting that is run on file save is cancelled.',
    'preference.editor.formatOnSaveTimeoutError': 'Aborted format on save after ${0}ms',
    'preference.editor.maxTokenizationLineLength': 'Max Tokenization Line Length',
    'preference.editor.quickSuggestionsDelay': 'Quick suggestions show delay (in ms) Defaults to 10 (ms)',
    'preference.editor.largeFile': 'Large File Size',
    'preference.editor.formatOnPaste': 'Format On Paste',
    'preference.files.eol': 'EOL',
    'preference.files.trimFinalNewlines': 'Trim Final Newlines',
    'preference.files.trimTrailingWhitespace': 'Trim Trailing Whitespace',
    'preference.files.insertFinalNewline': 'Insert Final Newline',
    'preference.editor.lineHeight': 'Line Height',
    'preference.editor.saveCodeActions': 'Code Actions On Save',
    'preference.editor.saveCodeActionsNotification': 'Whether to notify when code operations run at save time',

    'keymaps.tab.name': 'Keyboard Shortcuts',

    'preference.editor.wrapTab': 'Wrap Editor Tabs',
    'preference.editor.preferredFormatter': 'Default Formatter',
    'preference.editor.fontFamily': 'Font Family',
    'preference.editor.minimap': 'minimap',
    'preference.editor.forceReadOnly': 'readOnly',
    'preference.editor.renderLineHighlight': 'Render Line Highlight',
    'preference.editor.askIfDiff': 'Error If File On Disk is newer',
    'preference.editor.autoSave': 'Editor Auto Save',
    'preference.editor.autoSaveDelay': 'Auto Save Delay',
    'preference.editor.detectIndentation': 'Auto Detect Indentation',
    'preference.editor.bracketPairColorization.enabled': 'Bracket Pair Colorization',
    'preference.editor.fontWeight': 'Font Weight',

    'preference.editor.wordWrap': 'Word Wrap',
    'preference.editor.wordWrapColumn': 'Word Wrap Length',

    'preference.item.notValid': '{0} is not a valid option',

    // Editor Configurations
    'editor.configuration.formatOnSaveTimeout':
      'Control the timeout time of formatting (ms). Effective Only when `#editor.formatOnSave#` enables.',
    'editor.configuration.enablePreviewFromCodeNavigation':
      'Controls whether editors remain in preview when a code navigation is started from them. Preview editors do not keep open and are reused until explicitly set to be kept open (e.g. via double click or editing). This value is ignored when `#workbench.editor.enablePreview#` is disabled.',
    'editor.configuration.wrapTab':
      'Controls whether to wrap editor tabs instead of scroll mode when tabs are beyond the visible area.',
    'editor.configuration.askIfDiff': 'When saving files, throw error if the file on disk has a newer version.',
    'editor.configuration.autoSave': 'Controls how dirty files are auto saved.',
    'editor.configuration.autoSaveDelay':
      "Controls the delay in ms after which a dirty file is saved automatically. Only applies when `#editor.formatOnSave#` is set to 'Save After Delay'.",
    'editor.configuration.forceReadOnly': 'If Enable readOnly',
    'editor.configuration.largeFileSize': 'Custom size of the large file (B)',
    'editor.configuration.fontFamily': 'Controls the font family.',
    'editor.configuration.fontWeight':
      'Controls the font weight. Accepts "normal" and "bold" keywords or numbers between 1 and 1000.',
    'editor.configuration.lineDecorationsWidth':
      'The width reserved for line decorations (in px). Line decorations are placed between line numbers and the editor content. You can pass in a string in the format floating point followed by "ch". e.g. 1.3ch. Defaults to 10.',
    'editor.configuration.lineNumbersMinChars':
      'Control the width of line numbers, by reserving horizontal space for rendering at least an amount of digits. Defaults to 5.',
    'editor.configuration.wordWrapBreakBeforeCharacters':
      "Configure word wrapping characters. A break will be introduced before these characters. Defaults to '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋'.",
    'editor.configuration.wrappingStrategy': 'Controls the algorithm that computes wrapping points.',
    'editor.configuration.wordWrapBreakAfterCharacters':
      "Configure word wrapping characters. A break will be introduced after these characters. Defaults to ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣'.",
    'editor.configuration.wordWrapMinified':
      'Force word wrapping when the text appears to be of a minified/generated file. Defaults to true.',
    'editor.configuration.selectOnLineNumbers':
      'Should the corresponding line be selected when clicking on the line number? Defaults to true.',
    'editor.configuration.revealHorizontalRightPadding':
      'When revealing the cursor, a virtual padding (px) is added to the cursor, turning it into a rectangle. This virtual padding ensures that the cursor gets revealed before hitting the edge of the viewport. Defaults to 30 (px).',
    'editor.configuration.fixedOverflowWidgets': 'Display overflow widgets as fixed.',
    'editor.configuration.extraEditorClassName': 'Class name to be added to the editor.',
    'editor.configuration.ariaLabel': "The aria label for the editor's textarea (when it is focused).",
    'editor.configuration.suggest.insertMode':
      'Controls whether words are overwritten when accepting completions. Note that this depends on extensions opting into this feature.',
    'editor.configuration.suggest.filterGraceful':
      'Controls whether filtering and sorting suggestions accounts for small typos.',
    'editor.configuration.suggest.localityBonus':
      'Controls whether sorting favours words that appear close to the cursor.',
    'editor.configuration.suggest.shareSuggestSelections':
      'Controls whether remembered suggestion selections are shared between multiple workspaces and windows (needs `#editor.suggestSelection#`).',
    'editor.configuration.suggest.snippetsPreventQuickSuggestions':
      'Controls whether an active snippet prevents quick suggestions.',
    'editor.configuration.suggest.showIcons': 'Controls whether to show or hide icons in suggestions.',
    'editor.configuration.suggest.maxVisibleSuggestions':
      'Controls how many suggestions IntelliSense will show before showing a scrollbar (maximum 15).',
    'editor.configuration.suggest.showMethods': 'When enabled IntelliSense shows `method`-suggestions.',
    'editor.configuration.suggest.showFunctions': 'When enabled IntelliSense shows `function`-suggestions.',
    'editor.configuration.suggest.showConstructors': 'When enabled IntelliSense shows `constructor`-suggestions.',
    'editor.configuration.suggest.showFields': 'When enabled IntelliSense shows `field`-suggestions.',
    'editor.configuration.suggest.showVariables': 'When enabled IntelliSense shows `variable`-suggestions.',
    'editor.configuration.suggest.showClasss': 'When enabled IntelliSense shows `class`-suggestions.',
    'editor.configuration.suggest.showStructs': 'When enabled IntelliSense shows `struct`-suggestions.',
    'editor.configuration.suggest.showInterfaces': 'When enabled IntelliSense shows `interface`-suggestions.',
    'editor.configuration.suggest.showModules': 'When enabled IntelliSense shows `module`-suggestions.',
    'editor.configuration.suggest.showPropertys': 'When enabled IntelliSense shows `property`-suggestions.',
    'editor.configuration.suggest.showEvents': 'When enabled IntelliSense shows `event`-suggestions.',
    'editor.configuration.suggest.showOperators': 'When enabled IntelliSense shows `operator`-suggestions.',
    'editor.configuration.suggest.showUnits': 'When enabled IntelliSense shows `unit`-suggestions.',
    'editor.configuration.suggest.showValues': 'When enabled IntelliSense shows `value`-suggestions.',
    'editor.configuration.suggest.showConstants': 'When enabled IntelliSense shows `constant`-suggestions.',
    'editor.configuration.suggest.showEnums': 'When enabled IntelliSense shows `enum`-suggestions.',
    'editor.configuration.suggest.showEnumMembers': 'When enabled IntelliSense shows `enumMember`-suggestions.',
    'editor.configuration.suggest.showKeywords': 'When enabled IntelliSense shows `keyword`-suggestions.',
    'editor.configuration.suggest.showTexts': 'When enabled IntelliSense shows `text`-suggestions.',
    'editor.configuration.suggest.showColors': 'When enabled IntelliSense shows `color`-suggestions.',
    'editor.configuration.suggest.showFiles': 'When enabled IntelliSense shows `file`-suggestions.',
    'editor.configuration.suggest.showReferences': 'When enabled IntelliSense shows `reference`-suggestions.',
    'editor.configuration.suggest.showCustomcolors': 'When enabled IntelliSense shows `customcolor`-suggestions.',
    'editor.configuration.suggest.showFolders': 'When enabled IntelliSense shows `folder`-suggestions.',
    'editor.configuration.suggest.showTypeParameters': 'When enabled IntelliSense shows `typeParameter`-suggestions.',
    'editor.configuration.suggest.showSnippets': 'When enabled IntelliSense shows `snippet`-suggestions.',
    'editor.configuration.suggest.showUsers': 'When enabled IntelliSense shows `user`-suggestions.',
    'editor.configuration.suggest.showIssues': 'When enabled IntelliSense shows `issues`-suggestions.',
    'editor.configuration.suggest.statusBar.visible':
      'Controls the visibility of the status bar at the bottom of the suggest widget.',
    'editor.configuration.suggest.preview': 'Enable or disable the rendering of the suggestion preview.',
    'editor.configuration.suggest.details.visible':
      'Controls whether editor code completion expands details by default',
    // inlineSuggest start
    'editor.configuration.inlineSuggest.enabled': 'Enable or disable the rendering of automatic inline completions.',
    'editor.configuration.inlineSuggest.showToolbar': 'Controls when to show the inline suggestion toolbar.',
    'editor.configuration.inlineSuggest.showToolbar.always':
      'Show the inline suggestion toolbar whenever an inline suggestion is shown.',
    'editor.configuration.inlineSuggest.showToolbar.onHover':
      'Show the inline suggestion toolbar when hovering over an inline suggestion.',
    'editor.configuration.inlineSuggest.showToolbar.never': 'Never show the inline suggestion toolbar.',
    // inlineSuggest end
    // hover start
    'editor.configuration.hover.enabled': 'Controls whether the hover is shown.',
    'editor.configuration.hover.delay': 'Controls the delay in milliseconds after which the hover is shown.',
    'editor.configuration.hover.sticky':
      'Controls whether the hover should remain visible when mouse is moved over it.',
    'editor.configuration.hover.hidingDelay':
      'Controls the delay in milliseconds after which the hover is hidden. Requires `editor.hover.sticky` to be.',
    'editor.configuration.hover.above': "Prefer showing hovers above the line, if there's space.",
    // hover end
    'editor.configuration.experimental.stickyScroll':
      'Shows the nested current scopes during the scroll at the top of the editor.',
    'editor.configuration.customCodeActionMenu.showHeaders':
      'Enabling this will show the code action menu with group headers, if the custom code action menu is enabled.',
    'editor.configuration.useCustomCodeActionMenu': 'Enabling this adjusts how the code action menu is rendered.',
    'editor.configuration.letterSpacing': 'Controls the letter spacing in pixels.',
    'editor.configuration.lineNumbers': 'Controls the display of line numbers.',
    'editor.configuration.lineNumbers.off': 'Line numbers are not rendered.',
    'editor.configuration.lineNumbers.on': 'Line numbers are rendered as absolute number.',
    'editor.configuration.lineNumbers.relative': 'Line numbers are rendered as distance in lines to cursor position.',
    'editor.configuration.lineNumbers.interval': 'Line numbers are rendered every 10 lines.',
    'editor.configuration.renderFinalNewline': 'Render last line number when the file ends with a newline.',
    'editor.configuration.rulers':
      'Render vertical rulers after a certain number of monospace characters. Use multiple values for multiple rulers. No rulers are drawn if array is empty.',
    'editor.configuration.wordSeparators':
      'Characters that will be used as word separators when doing word related navigations or operations.',
    'editor.configuration.tabSize':
      'The number of spaces a tab is equal to. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.',
    'editor.configuration.insertSpaces':
      'Insert spaces when pressing `Tab`. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.',
    'editor.configuration.detectIndentation':
      'Controls whether `#editor.tabSize#` and `#editor.insertSpaces#` will be automatically detected when a file is opened based on the file contents.',
    'editor.configuration.roundedSelection': 'Controls whether selections should have rounded corners.',
    'editor.configuration.scrollBeyondLastLine': 'Controls whether the editor will scroll beyond the last line.',
    'editor.configuration.scrollBeyondLastColumn':
      'Controls the number of extra characters beyond which the editor will scroll horizontally.',
    'editor.configuration.smoothScrolling': 'Controls whether the editor will scroll using an animation.',
    'editor.configuration.minimap.enabled': 'Controls whether the minimap is shown.',
    'editor.configuration.minimap.side': 'Controls the side where to render the minimap.',
    'editor.configuration.minimap.showSlider': 'Controls whether the minimap slider is automatically hidden.',
    'editor.configuration.minimap.renderCharacters':
      'Render the actual characters on a line as opposed to color blocks.',
    'editor.configuration.minimap.maxColumn':
      'Limit the width of the minimap to render at most a certain number of columns.',
    'editor.configuration.find.seedSearchStringFromSelection':
      'Controls whether the search string in the Find Widget is seeded from the editor selection.',
    'editor.configuration.find.autoFindInSelection':
      'Controls whether the find operation is carried out on selected text or the entire file in the editor.',
    'editor.configuration.find.globalFindClipboard':
      'Controls whether the Find Widget should read or modify the shared find clipboard on macOS.',
    'editor.configuration.find.addExtraSpaceOnTop':
      'Controls whether the Find Widget should add extra lines on top of the editor. When true, you can scroll beyond the first line when the Find Widget is visible.',
    'editor.configuration.wordWrap.off': 'Lines will never wrap.',
    'editor.configuration.wordWrap.on': 'Lines will wrap at the viewport width.',
    'editor.configuration.wordWrap.wordWrapColumn': 'Lines will wrap at `#editor.wordWrapColumn#`.',
    'editor.configuration.wordWrap.bounded':
      'Lines will wrap at the minimum of viewport and `#editor.wordWrapColumn#`.',
    'editor.configuration.wordWrap': 'Controls how lines should wrap.',
    'editor.configuration.wordWrapColumn':
      'Controls the wrapping column of the editor when `#editor.wordWrap#` is `wordWrapColumn` or `bounded`.',
    'editor.configuration.wrappingIndent.none': 'No indentation. Wrapped lines begin at column 1.',
    'editor.configuration.wrappingIndent.same': 'Wrapped lines get the same indentation as the parent.',
    'editor.configuration.wrappingIndent.indent': 'Wrapped lines get +1 indentation toward the parent.',
    'editor.configuration.wrappingIndent.deepIndent': 'Wrapped lines get +2 indentation toward the parent.',
    'editor.configuration.wrappingIndent': 'Controls the indentation of wrapped lines.',
    'editor.configuration.mouseWheelScrollSensitivity':
      'A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.',
    'editor.configuration.fastScrollSensitivity': 'Scrolling speed multiplier when pressing `Alt`.',
    'editor.configuration.multiCursorModifier.ctrlCmd':
      'Maps to `Control` on Windows and Linux and to `Command` on macOS.',
    'editor.configuration.multiCursorModifier.alt': 'Maps to `Alt` on Windows and Linux and to `Option` on macOS.',
    'editor.configuration.multiCursorMergeOverlapping': 'Merge multiple cursors when they are overlapping.',
    'editor.configuration.quickSuggestions.strings': 'Enable quick suggestions inside strings.',
    'editor.configuration.quickSuggestions.comments': 'Enable quick suggestions inside comments.',
    'editor.configuration.quickSuggestions.other': 'Enable quick suggestions outside of strings and comments.',
    'editor.configuration.quickSuggestions': 'Controls whether suggestions should automatically show up while typing.',
    'editor.configuration.quickSuggestionsDelay':
      'Controls the delay in milliseconds after which quick suggestions will show up.',
    'editor.configuration.parameterHints.enabled':
      'Enables a pop-up that shows parameter documentation and type information as you type.',
    'editor.configuration.parameterHints.cycle':
      'Controls whether the parameter hints menu cycles or closes when reaching the end of the list.',
    'editor.configuration.autoClosingBrackets.languageDefined':
      'Use language configurations to determine when to autoclose brackets.',
    'editor.configuration.autoClosingBrackets.beforeWhitespace':
      'Autoclose brackets only when the cursor is to the left of whitespace.',
    'editor.configuration.autoClosingBrackets':
      'Controls whether the editor should automatically close brackets after the user adds an opening bracket.',
    'editor.configuration.autoClosingQuotes.languageDefined':
      'Use language configurations to determine when to autoclose quotes.',
    'editor.configuration.autoClosingQuotes.beforeWhitespace':
      'Autoclose quotes only when the cursor is to the left of whitespace.',
    'editor.configuration.autoClosingQuotes':
      'Controls whether the editor should automatically close quotes after the user adds an opening quote.',
    'editor.configuration.autoSurround.languageDefined':
      'Use language configurations to determine when to automatically surround selections.',
    'editor.configuration.autoSurround.brackets': 'Surround with brackets but not quotes.',
    'editor.configuration.autoSurround.quotes': 'Surround with quotes but not brackets.',
    'editor.configuration.autoSurround': 'Controls whether the editor should automatically surround selections.',
    'editor.configuration.formatOnType':
      'Controls whether the editor should automatically format the line after typing.',
    'editor.configuration.formatOnPaste':
      'Controls whether the editor should automatically format the pasted content. A formatter must be available and the formatter should be able to format a range in a document.',
    'editor.configuration.autoIndent':
      'Controls whether the editor should automatically adjust the indentation when users type, paste or move lines. Extensions with indentation rules of the language must be available.',
    'editor.configuration.suggestOnTriggerCharacters':
      'Controls whether suggestions should automatically show up when typing trigger characters.',
    'editor.configuration.acceptSuggestionOnEnterSmart':
      'Only accept a suggestion with `Enter` when it makes a textual change.',
    'editor.configuration.acceptSuggestionOnEnter':
      'Controls whether suggestions should be accepted on `Enter`, in addition to `Tab`. Helps to avoid ambiguity between inserting new lines or accepting suggestions.',
    'editor.configuration.acceptSuggestionOnCommitCharacter':
      'Controls whether suggestions should be accepted on commit characters. For example, in JavaScript, the semi-colon (`;`) can be a commit character that accepts a suggestion and types that character.',
    'editor.configuration.snippetSuggestions.top': 'Show snippet suggestions on top of other suggestions.',
    'editor.configuration.snippetSuggestions.bottom': 'Show snippet suggestions below other suggestions.',
    'editor.configuration.snippetSuggestions.inline': 'Show snippets suggestions with other suggestions.',
    'editor.configuration.snippetSuggestions.none': 'Do not show snippet suggestions.',
    'editor.configuration.snippetSuggestions':
      'Controls whether snippets are shown with other suggestions and how they are sorted.',
    'editor.configuration.emptySelectionClipboard':
      'Controls whether copying without a selection copies the current line.',
    'editor.configuration.copyWithSyntaxHighlighting':
      'Controls whether syntax highlighting should be copied into the clipboard.',
    'editor.configuration.wordBasedSuggestions':
      'Controls whether completions should be computed based on words in the document.',
    'editor.configuration.suggestSelection.first': 'Always select the first suggestion.',
    'editor.configuration.suggestSelection.recentlyUsed':
      'Select recent suggestions unless further typing selects one, e.g. `console.| -> console.log` because `log` has been completed recently.',
    'editor.configuration.suggestSelection.recentlyUsedByPrefix':
      'Select suggestions based on previous prefixes that have completed those suggestions, e.g. `co -> console` and `con -> const`.',
    'editor.configuration.suggestSelection': 'Controls how suggestions are pre-selected when showing the suggest list.',
    'editor.configuration.suggestFontSize':
      'Font size for the suggest widget. When set to `0`, the value of `#editor.fontSize#` is used.',
    'editor.configuration.suggestLineHeight':
      'Line height for the suggest widget. When set to `0`, the value of `#editor.lineHeight#` is used.',
    'editor.configuration.tabCompletion.on': 'Tab complete will insert the best matching suggestion when pressing tab.',
    'editor.configuration.tabCompletion.off': 'Disable tab completions.',
    'editor.configuration.tabCompletion.onlySnippets':
      "Tab complete snippets when their prefix match. Works best when 'quickSuggestions' aren't enabled.",
    'editor.configuration.tabCompletion': 'Enables tab completions.',
    'editor.configuration.suggest.filtered':
      'Controls whether some suggestion types should be filtered from IntelliSense. A list of suggestion types can be found here: https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions.',
    'editor.configuration.suggest.filtered.method':
      'When set to `false` IntelliSense never shows `method` suggestions.',
    'editor.configuration.suggest.filtered.function':
      'When set to `false` IntelliSense never shows `function` suggestions.',
    'editor.configuration.suggest.filtered.constructor':
      'When set to `false` IntelliSense never shows `constructor` suggestions.',
    'editor.configuration.suggest.filtered.field': 'When set to `false` IntelliSense never shows `field` suggestions.',
    'editor.configuration.suggest.filtered.variable':
      'When set to `false` IntelliSense never shows `variable` suggestions.',
    'editor.configuration.suggest.filtered.class': 'When set to `false` IntelliSense never shows `class` suggestions.',
    'editor.configuration.suggest.filtered.struct':
      'When set to `false` IntelliSense never shows `struct` suggestions.',
    'editor.configuration.suggest.filtered.interface':
      'When set to `false` IntelliSense never shows `interface` suggestions.',
    'editor.configuration.suggest.filtered.module':
      'When set to `false` IntelliSense never shows `module` suggestions.',
    'editor.configuration.suggest.filtered.property':
      'When set to `false` IntelliSense never shows `property` suggestions.',
    'editor.configuration.suggest.filtered.event': 'When set to `false` IntelliSense never shows `event` suggestions.',
    'editor.configuration.suggest.filtered.operator':
      'When set to `false` IntelliSense never shows `operator` suggestions.',
    'editor.configuration.suggest.filtered.unit': 'When set to `false` IntelliSense never shows `unit` suggestions.',
    'editor.configuration.suggest.filtered.value': 'When set to `false` IntelliSense never shows `value` suggestions.',
    'editor.configuration.suggest.filtered.constant':
      'When set to `false` IntelliSense never shows `constant` suggestions.',
    'editor.configuration.suggest.filtered.enum': 'When set to `false` IntelliSense never shows `enum` suggestions.',
    'editor.configuration.suggest.filtered.enumMember':
      'When set to `false` IntelliSense never shows `enumMember` suggestions.',
    'editor.configuration.suggest.filtered.keyword':
      'When set to `false` IntelliSense never shows `keyword` suggestions.',
    'editor.configuration.suggest.filtered.text': 'When set to `false` IntelliSense never shows `text` suggestions.',
    'editor.configuration.suggest.filtered.color': 'When set to `false` IntelliSense never shows `color` suggestions.',
    'editor.configuration.suggest.filtered.file': 'When set to `false` IntelliSense never shows `file` suggestions.',
    'editor.configuration.suggest.filtered.reference':
      'When set to `false` IntelliSense never shows `reference` suggestions.',
    'editor.configuration.suggest.filtered.customcolor':
      'When set to `false` IntelliSense never shows `customcolor` suggestions.',
    'editor.configuration.suggest.filtered.folder':
      'When set to `false` IntelliSense never shows `folder` suggestions.',
    'editor.configuration.suggest.filtered.typeParameter':
      'When set to `false` IntelliSense never shows `typeParameter` suggestions.',
    'editor.configuration.suggest.filtered.snippet':
      'When set to `false` IntelliSense never shows `snippet` suggestions.',
    'editor.configuration.editor.gotoLocation.multiple':
      "Controls the behavior of 'Go To' commands, like Go To Definition, when multiple target locations exist.",
    'editor.configuration.gotoLocation.multiple.peek': 'Show peek view of the results (default)',
    'editor.configuration.gotoLocation.multiple.gotoAndPeek': 'Go to the primary result and show a peek view',
    'editor.configuration.gotoLocation.multiple.goto':
      'Go to the primary result and enable peek-less navigation to others',
    'editor.configuration.selectionHighlight':
      'Controls whether the editor should highlight matches similar to the selection.',
    'editor.configuration.occurrencesHighlight':
      'Controls whether the editor should highlight semantic symbol occurrences.',
    'editor.configuration.overviewRulerLanes':
      'Controls the number of decorations that can show up at the same position in the overview ruler.',
    'editor.configuration.overviewRulerBorder': 'Controls whether a border should be drawn around the overview ruler.',
    'editor.configuration.cursorBlinking': 'Control the cursor animation style.',
    'editor.configuration.mouseWheelZoom': 'Zoom the font of the editor when using mouse wheel and holding `Ctrl`.',
    'editor.configuration.cursorSmoothCaretAnimation': 'Controls whether the smooth caret animation should be enabled.',
    'editor.configuration.cursorStyle': 'Controls the cursor style.',
    'editor.configuration.cursorWidth':
      'Controls the width of the cursor when `#editor.cursorStyle#` is set to `line`.',
    'editor.configuration.fontLigatures': 'Enables/Disables font ligatures.',
    'editor.configuration.hideCursorInOverviewRuler':
      'Controls whether the cursor should be hidden in the overview ruler.',
    'editor.configuration.renderWhitespace.boundary':
      'Render whitespace characters except for single spaces between words.',
    'editor.configuration.renderWhitespace.selection': 'Render whitespace characters only on selected text.',
    'editor.configuration.renderWhitespace': 'Controls how the editor should render whitespace characters.',
    'editor.configuration.rename.enablePreview': 'Enable/disable the ability to preview changes before renaming',
    'editor.configuration.renderControlCharacters': 'Controls whether the editor should render control characters.',
    'editor.configuration.guides.indentation': 'Controls whether the editor should render indent guides.',
    'editor.configuration.guides.highlightActiveIndentation':
      'Controls whether the editor should highlight the active indent guide.',
    'editor.configuration.guides.bracketPairs': 'Controls whether bracket pair guides are enabled or not.',
    'editor.configuration.renderLineHighlight.all': 'Highlights both the gutter and the current line.',
    'editor.configuration.renderLineHighlight': 'Controls how the editor should render the current line highlight.',
    'editor.configuration.codeLens': 'Controls whether the editor shows CodeLens.',
    'editor.configuration.folding': 'Controls whether the editor has code folding enabled.',
    'editor.configuration.foldingStrategy':
      'Controls the strategy for computing folding ranges. `auto` uses a language specific folding strategy, if available. `indentation` uses the indentation based folding strategy.',
    'editor.configuration.showFoldingControls':
      'Controls whether the fold controls on the gutter are automatically hidden.',
    'editor.configuration.matchBrackets': 'Highlight matching brackets when one of them is selected.',
    'editor.configuration.glyphMargin':
      'Controls whether the editor should render the vertical glyph margin. Glyph margin is mostly used for debugging.',
    'editor.configuration.useTabStops': 'Inserting and deleting whitespace follows tab stops.',
    'editor.configuration.trimAutoWhitespace': 'Remove trailing auto inserted whitespace.',
    'editor.configuration.stablePeek':
      'Keep peek editors open even when double clicking their content or when hitting `Escape`.',
    'editor.configuration.dragAndDrop': 'Controls whether the editor should allow moving selections via drag and drop.',
    'editor.configuration.accessibilitySupport.auto':
      'The editor will use platform APIs to detect when a Screen Reader is attached.',
    'editor.configuration.accessibilitySupport.on':
      'The editor will be permanently optimized for usage with a Screen Reader.',
    'editor.configuration.accessibilitySupport.off':
      'The editor will never be optimized for usage with a Screen Reader.',
    'editor.configuration.accessibilitySupport':
      'Controls whether the editor should run in a mode where it is optimized for screen readers.',
    'editor.configuration.showUnused': 'Controls fading out of unused code.',
    'editor.configuration.comments.insertSpace':
      'Insert a space after the line comment token and inside the block comments tokens.',
    'editor.configuration.comments.ignoreEmptyLines': 'Ignore empty lines when inserting line comments.',
    'editor.configuration.links': 'Controls whether the editor should detect links and make them clickable.',
    'editor.configuration.colorDecorators':
      'Controls whether the editor should render the inline color decorators and color picker.',
    'editor.configuration.lightbulb.enabled': 'Enables the code action lightbulb in the editor.',
    'editor.configuration.lightbulb.enabled.off': 'Disable the code action menu.',
    'editor.configuration.lightbulb.enabled.onCode': 'Show the code action menu when the cursor is on lines with code.',
    'editor.configuration.lightbulb.enabled.on':
      'Show the code action menu when the cursor is on lines with code or on empty lines.',
    'editor.configuration.maxTokenizationLineLength':
      'Lines above this length will not be tokenized for performance reasons',
    'editor.configuration.codeActionsOnSave.organizeImports':
      'Controls whether organize imports action should be run on file save.',
    'editor.configuration.codeActionsOnSave.fixAll': 'Controls whether auto fix action should be run on file save.',
    'editor.configuration.codeActionsOnSave': 'Code action kinds to be run on save.',
    'editor.configuration.codeActionsOnSaveTimeout':
      'Timeout in milliseconds after which the code actions that are run on save are cancelled.',
    'editor.configuration.codeActionsOnSaveNotification': 'Whether to notify when code operations run at save time.',
    'editor.configuration.selectionClipboard': 'Controls whether the Linux primary clipboard should be supported.',
    'editor.configuration.largeFileOptimizations':
      'Special handling for large files to disable certain memory intensive features.',
    'editor.configuration.renderIndicators':
      'Controls whether the diff editor shows +/- indicators for added/removed changes.',
    'editor.configuration.defaultFormatter': 'Default code formatter',
    'editor.configuration.tokenColorCustomizations': 'Overwrite token colors of current color theme',
    'editor.configuration.semanticHighlighting.enabled':
      'Controls whether the semanticHighlighting is shown for the languages that support it.',
    'editor.configuration.semanticHighlighting.true': 'Semantic highlighting enabled for all color themes.',
    'editor.configuration.semanticHighlighting.false': 'Semantic highlighting disabled for all color themes.',
    'editor.configuration.semanticHighlighting.configuredByTheme':
      "Semantic highlighting is configured by the current color theme's `semanticHighlighting` setting.",
    'editor.configuration.experimental.stickyScroll.enabled':
      'Shows the nested current scopes during the scroll at the top of the editor.',
    'editor.configuration.previewMode': 'Enable Preview Mode',
    'editor.configuration.workbench.editorAssociations':
      'Configure glob patterns to editors (e.g. `"*.hex": "hexEditor.hexEdit"`). These have precedence over the default behavior.',
    'editor.configuration.preferredFormatter': 'Preferred formatter for files',
    'editor.configuration.bracketPairColorization.enabled':
      "Controls whether bracket pair colorization is enabled or not. Use 'workbench.colorCustomizations' to override the bracket highlight colors.",
    'editor.configuration.mouseBackForwardToNavigate':
      "Enables the use of mouse buttons four and five for commands 'Go Back' and 'Go Forward'.",
    'editor.configuration.suggest.insertMode.insert': 'Insert suggestion without overwriting text right of the cursor.',
    'editor.configuration.suggest.insertMode.replace': 'Insert suggestion and overwrite text right of the cursor.',
    'editor.configuration.unicodeHighlight.ambiguousCharacters':
      'Controls whether characters are highlighted that can be confused with basic ASCII characters, except those that are common in the current user locale.',

    'diffEditor.configuration.renderSideBySide':
      'Controls whether the diff editor shows the diff side by side or inline.',
    'diffEditor.configuration.ignoreTrimWhitespace':
      'Controls whether the diff editor shows changes in leading or trailing whitespace as diffs.',
    'diffEditor.action.toggleCollapseUnchangedRegions': 'Toggle Collapse Unchanged Regions',

    'editor.largeFile.prevent': 'The file is too large, continuing to open it may cause lag or crash.',
    'editor.autoSave.enum.off': 'OFF',
    'editor.autoSave.enum.editorFocusChange': 'When editor focus changed',
    'editor.autoSave.enum.afterDelay': 'Save after delay',
    'editor.autoSave.enum.windowLostFocus': 'When window lost focus',
    'editor.file.prevent.stillOpen': 'Open Anyway',

    'editor.workspaceSymbol.quickopen': 'Search Workspace Symbol',
    'editor.workspaceSymbolClass.quickopen': 'Search Workspace Class Symbol',
    'editor.workspaceSymbol.description': 'Go to Symbol in Workspace',
    'editor.workspaceSymbol.search': 'Type to search for symbols',
    'editor.workspaceSymbolClass.search': 'Type to search for class symbols',
    'editor.workspaceSymbol.notfound': 'No symbols matching',
    'editor.workspaceSymbolClass.notfound': 'No class symbols matching',

    'preference.diffEditor.renderSideBySide': 'Render Side By Side',
    'preference.diffEditor.ignoreTrimWhitespace': 'Ignore Trim Whitespace',

    'preference.mergeEditor.autoApplyNonConflictChanges': 'Automatically apply non-conflicting changes',

    'validate.tree.emptyFileNameError': 'Please provide a file or folder name',
    'validate.tree.fileNameStartsWithSlashError': 'File or folder name cannot start with /',
    'validate.tree.fileNameFollowOrStartWithSpaceWarning': 'Leading or trailing spaces detected in file or folder name',
    'validate.tree.fileNameExistsError': 'File or folder **{0}** already exists. Please use a different name.',
    'validate.tree.invalidFileNameError': 'The name **{0}** is not available. Please use a different name.',

    'editor.close.all': 'Close All Editors',

    'opened.editors.title': 'OPENED EDITORS',
    'opened.editors.save.all': 'Save All',
    'opened.editors.close.all': 'Close All',
    'opened.editors.close.byGroup': 'Close files in the group',
    'opened.editors.save.byGroup': 'Save files in the group',
    'opened.editors.empty': 'No file is open in the editor',
    'opened.editors.group.title': 'GROUP {0}',
    'opened.editors.open': 'Open',
    'opened.editors.openToTheSide': 'Open To The Side',
    'opened.editors.compare': 'Compare With Current File',
    'opened.editors.copyRelativePath': 'Copy Relative Path',
    'opened.editors.copyPath': 'Copy Path',
    'opened.editors.unsaved': '{0} unsaved',

    'terminal.name': 'Terminal',
    'terminal.disconnected': 'Terminal Already Disconnected',
    'terminal.can.not.create': 'Create Terminal Failed',
    'terminal.can.not.reconnect': 'Terminal Unavailable, Please',
    'terminal.stop': 'Stop The Terminal',
    'terminal.try.reconnect': 'Try To Reconnect The Terminal',
    'terminal.try.recreate': 'Try To Recreate The Terminal',
    'terminal.new': 'Create Terminal',
    'terminal.new.type': 'Create terminal by type',
    'terminal.split': 'Split Terminal',
    'terminal.clear': 'Remove All Terminals',
    'terminal.clear.content': 'Clear All Contents',
    'terminal.independ': 'Independent Terminal',
    'terminal.maximum': 'Maximum Terminal Panel',
    'terminal.or': 'Or',
    'terminal.search': 'Search',
    'terminal.search.next': 'Search Next',
    'terminal.openWithPath': 'Open In Integrated Terminal',
    'terminal.remove': 'Kill terminal',
    'terminal.menu.search': 'Search',
    'terminal.menu.split': 'Split',
    'terminal.menu.rename': 'Rename',
    'terminal.menu.selectAll': 'Select All',
    'terminal.menu.copy': 'Copy',
    'terminal.menu.paste': 'Paste',
    'terminal.menu.clear': 'Clear',
    'terminal.menu.stop': 'Stop',
    'terminal.menu.stopGroup': 'Stop Group',
    'terminal.menu.clearGroups': 'Clear All Terminals',
    'terminal.menu.selectType': 'Default Terminal Type',
    'terminal.menu.moreSettings': 'More Settings',
    'terminal.menu.clearCurrentContent': 'Clear',
    'terminal.menu.selectCurrentContent': 'Select All',
    'terminal.menu.clearAllContents': 'Clear All Terminals Content',
    'terminal.menu.selectAllContent': 'Select All Terminals Content',
    'terminal.environment.changed': "Extensions have made changes to this terminal's environment",
    'terminal.environment.changes': "Extensions want to make the following changes to the terminal's environment:",
    'terminal.environment.removal': "Extensions want to remove these existing changes from the terminal's environment:",
    'terminal.launchFail.cwdNotDirectory': 'Starting directory (cwd) "{0}" is not a directory',
    'terminal.launchFail.cwdDoesNotExist': 'Starting directory (cwd) "{0}" does not exist',
    'terminal.launchFail.executableIsNotFileOrSymlink': 'Path to shell executable "{0}" is not a file or a symlink',
    'terminal.launchFail.executableDoesNotExist': 'Path to shell executable "{0}" does not exist',
    'terminal.openFile': 'Open file in editor',
    'terminal.focusFolder': 'Focus folder in explorer',
    'terminal.openFolder': 'Open folder in new window',
    'terminal.relaunch': 'Relaunch Terminal',
    'terminal.toggleTerminal': 'Toggle Terminal',
    'terminal.killProcess': 'Kill Process',
    'terminal.process.unHealthy':
      '*This terminal session has been timed out and killed by the system. Please open a new terminal session to proceed with operations.',
    'terminal.selectCWDForNewTerminal': 'Select current working directory for new terminal',

    'terminal.focusNext.inTerminalGroup': 'Terminal: Focus Next Terminal in Terminal Group',
    'terminal.focusPrevious.inTerminalGroup': 'Terminal: Focus Previous Terminal in Terminal Group',

    'terminal.ai.requesting': 'AI Requesting...',
    'terminal.ai.selectHint': 'Use keyboard ↑↓ to select a command, ⏎ to confirm command',
    'terminal.ai.thinking': 'AI Thinking...',
    'terminal.ai.escClose': 'Press ESC to close the dialog',
    'terminal.ai.headerHint': 'Use AI to get terminal input suggestions',
    'terminal.ai.inputHint': 'Eg. show current process pid',
    'terminal.ai.inputSharpToGetHint': 'Type # for AI Suggestions',
    'terminal.ai.cannotGetTerminalConnection':
      'Cannot establish terminal connection, please provide feedback in the user group',

    'view.command.show': 'Show {0}',

    'layout.tabbar.setting': 'Open Preference Panel',
    'debugger.menu.setValue': 'Set Value',
    'debugger.menu.setValue.param': 'Please input the value of this variable',

    'debugger.menu.copyValue': 'Copy Value',
    'debugger.menu.copyEvaluatePath': 'Copy as Expression',
    'debugger.menu.addToWatchExpressions': 'Add to Watch',

    'debugger.menu.restartFrame': 'Restart Frame',
    'debugger.menu.copyCallstack': 'Copy Call Stack',

    'theme.toggle': 'Color Theme',
    'theme.icon.toggle': 'File Icon Theme',
    'theme.productIcon.toggle': 'Product Icon Theme',

    'theme.base.vs': 'Light Theme',
    'theme.base.vs-dark': 'Dark Theme',
    'theme.base.hc': 'High Contrast Themes',
    'theme.current': 'Current',
    'theme.quickopen.plh': 'Select Color Theme（Up/Down Keys to Preview）',
    'theme.icon.quickopen.plh': 'Select Icon Theme（Up/Down Keys to Preview）',
    'theme.productIcon.quickopen.plh': 'Select Product Icon Theme（Up/Down Keys to Preview）',

    'preference.workbench.list.openMode':
      'Controls how to open items in trees and lists using the mouse (if supported). For parents with children in trees, this setting will control if a single click expands the parent or a double click. Note that some trees and lists might choose to ignore this setting if it is not applicable.',
    'preference.workbench.list.openMode.title': 'Tree/List open mode',

    'keymaps.search.placeholder': 'Type to search in keybindings',
    'keymaps.search.keyboard.placeholder': 'Type to search in keybindings',
    'keymaps.header.command.title': 'Command',
    'keymaps.header.source.title': 'Source',
    'keymaps.header.keybinding.title': 'Keybinding',
    'keymaps.header.when.title': 'When',

    'keymaps.source.default': 'DEFAULT',
    'keymaps.source.user': 'USER',
    'keymaps.source.workspace': 'WORKSPACE',
    'keymaps.keybinding.full.collide': 'Contains conflict between this shortcut and "{0}" command, please reset',
    'keymaps.keybinding.partial.collide': 'Contains conflict between this shortcut and "{0}" command, please reset',
    'keymaps.keybinding.shadow.collide': 'Contains conflict between this shortcut and "{0}" command, please reset',
    'keymaps.keybinding.duplicate': 'This shortcut is bound to the following {0} commands:',
    'keymaps.keybinding.loading': 'Setting keymaps ...',
    'keymaps.keybinding.success': 'Setting keymaps success',
    'keymaps.keybinding.fail': 'Setting keymaps fail',
    'keymaps.keybinding.require': 'keybinding value is required',
    'keymaps.action.edit': 'Edit',
    'keymaps.action.add': 'Add',
    'keymaps.action.reset': 'Reset',
    'keymaps.action.clear': 'Clear',
    'keymaps.edit.placeholder': 'Press Enter to save',
    'keymaps.editorTitle.openSource': 'Open Keymap ShortCut(JSON)',
    'keymaps.editorTitle.openKeymap': 'Open Keymap ShortCut',
    'keymaps.commandId.title': 'Command ID: {0}',

    'keybinding.combination.tip': '({0}) was pressed, waiting for more keys',

    'layout.tabbar.toggle': 'Toggle Bottom Panel',
    'layout.tabbar.expand': 'Maximize Bottom Panel',
    'layout.tabbar.retract': 'Retract Bottom Panel',
    'layout.view.hide': 'HIDE',
    'layout.action.openView': 'Open View ...',
    'layout.openView.containerTitle': 'SideBar / Panel',
    'layout.openView.viewTitle': '{0} / View',
    'marketplace.extension.update.now': 'Update now',
    'marketplace.extension.update.delay': 'Update later',
    'marketplace.extension.uninstall.failed': 'Failed to uninstall',
    'marketplace.extension.uninstall.failed.depended':
      'Cannot uninstall extension "{0}". Extension "{1}" depends on this.',
    'marketplace.extension.disabled.failed.depended':
      'Cannot disable extension "{0}". Extension "{1}" depends on this.',
    'marketplace.extension.reload.delay': 'Restart later',
    'marketplace.extension.reload.now': 'Restart now',
    'marketplace.extension.builtin': 'Builtin',
    'marketplace.extension.development': 'Develop',
    'marketplace.extension.enable': 'Enable',
    'marketplace.extension.disable': 'Disable',
    'marketplace.extension.enable.workspace': 'Enable(workspace)',
    'marketplace.extension.disable.workspace': 'Disable(workspace)',
    'marketplace.extension.enable.all': 'Enable All Extensions',
    'marketplace.extension.disable.all': 'Disable All Extensions',
    'marketplace.extension.install': 'Install',
    'marketplace.extension.container': 'Extensions',
    'marketplace.extension.empty.disabled': 'No disabled extensions yet',
    'marketplace.extension.notfound': 'No Extension',
    'marketplace.panel.hot': 'Hot Extensions',
    'marketplace.panel.search': 'Search',
    'marketplace.panel.enabled': 'Enabled',
    'marketplace.panel.disabled': 'Disabled',
    'marketplace.panel.tab.marketplace': 'Marketplace',
    'marketplace.panel.tab.placeholder.search': 'Search from marketplace',
    'marketplace.tab.installed': 'Installed',
    'marketplace.panel.tab.placeholder.installed': 'Search from installed',
    'marketplace.extension.findUpdate': 'Find Extension {0} has new version {1}，Do you want to update？',
    'marketplace.extension.updateAll': 'Find multiple extensions that can be updated. Do you want to update all?',
    'marketplace.extension.needreloadFromAll':
      'All extensions are updated and will take effect after reload window. Do you want to reload window now?',
    'marketplace.extension.needreload': 'Updating extension {0} is completed. Do you want to reload window now?',
    'marketplace.extension.canupdate': 'Can update',
    'marketplace.extension.updating': 'Updating',
    'marketplace.extension.update': 'Update',
    'marketplace.extension.installing': 'Installing',
    'marketplace.extension.reloadrequire': 'Require reload',
    'marketplace.extension.uninstalling': 'Uninstalling',
    'marketplace.extension.uninstall': 'Uninstall',
    'marketplace.extension.uninstalled': 'Uninstalled',
    'marketplace.extension.readme': 'Readme',
    'marketplace.extension.changelog': 'Changelog',
    'marketplace.extension.dependencies': 'Dependencies',
    'marketplace.extension.otherVersion': 'Install Other Version',
    'marketplace.extension.currentVersion': 'Current Version',
    'marketplace.extension.installed': 'Installed',
    'marketplace.quickopen.install': 'Install Extension',
    'marketplace.quickopen.install.byReleaseId': 'Install Extension (ReleaseId)',
    'marketplace.quickopen.install.releaseId': 'Extension ReleaseId',
    'marketplace.quickopen.install.releaseId.required': 'Extension Release ID is required',
    'marketplace.quickopen.install.id': 'Extension ID',
    'marketplace.quickopen.install.id.required': 'Extension ID is required',
    'marketplace.quickopen.install.version.required': 'Extension version is require',
    'marketplace.quickopen.install.version.placeholder': 'Extension version',
    'marketplace.quickopen.install.error': 'Install Extension has error',

    saveChangesMessage: 'Do you want to save the changes you made to {0}?',
    saveNFilesChangesMessage:
      "Do you want to save these changes you made to {0} files?  \n{1}  \n\nYour changes will be lost if you don't save them.",
    'file.prompt.dontSave': "Don't Save",
    'file.prompt.save': 'Save',
    'file.prompt.cancel': 'Cancel',
    'file.prompt.more.one': ' and 1 additional file.',
    'file.prompt.more.number': ' and {0} additional files.',

    'doc.saveError.failed': 'File Saving Failed. Reason: ',
    'doc.saveError.diff': '{0} cannot be saved because it has been modified by other editors.',
    'doc.saveError.diffAndSave': 'Compare...',
    'doc.saveError.overwrite': 'Overwrite',
    'editor.compareAndSave.title': '{0} (on Disk) <=> {1} (Editing) ',

    'workspace.openDirectory': 'Open Directory',
    'workspace.addFolderToWorkspace': 'Add Folder to Workspace ...',
    'workspace.removeFolderFromWorkspace': 'Remove Folder From Workspace',
    'workspace.saveWorkspaceAsFile': 'Save Workspace As ...',
    'workspace.openWorkspace': 'Open Workspace',
    'workspace.openWorkspaceTitle': 'Workspace',

    'window.toggleDevTools': 'Toggle Developer Tools',
    'window.reload': 'Reload Window',

    'outline.title': 'OutLine',
    'outline.noinfo': 'No symbols found in document',
    'outline.nomodel': 'There is no outline information',
    'outline.collapse.all': 'Collapse All',
    'outline.sort.kind': 'Sort By SymbolKind',
    'outline.sort.name': 'Sort By SymbolName',
    'outline.sort.position': 'Sort By Position',
    'outline.follow.cursor': 'Follow Cursor',

    'welcome.title': 'Welcome',
    'welcome.quickStart': 'Quick Start',
    'welcome.recent.workspace': 'Recent Workspaces',
    'welcome.workspace.noExist': 'Workspace path not exist',

    'markers.title': 'Problems',
    'markers.panel.content.empty': 'No problems have been detected in the workspace so far.',
    'markers.panel.filter.errors': 'errors',
    'markers.panel.filter.warnings': 'warnings',
    'markers.panel.filter.infos': 'infos',
    'markers.filter.placeholder': 'Filter. E.g.: text, **/*.ts, !**/node_modules/**',
    'markers.filter.content.empty': 'No results found with provided filter criteria.',
    'markers.filter.reset': 'Clear Filter.',
    'markers.status.no.problems': 'No Problems',

    'app.quit': 'Quit',
    'view.zoomReset': 'Zoom Reset',
    'view.zoomIn': 'Zoom In',
    'view.zoomOut': 'Zoom Out',
    tabCompletion: 'Enables tab completions.',
    'tabCompletion.off': 'Disable tab completions.',
    'tabCompletion.on': 'Tab complete will insert the best matching suggestion when pressing tab.',
    'tabCompletion.onlySnippets':
      "Tab complete snippets when their prefix match. Works best when 'quickSuggestions' aren't enabled.",
    'extension.invalidExthostReload.confirm.content':
      'Extension Host Process is invalid. Click to refresh to resume the process.',
    'extension.invalidExthostReload.confirm.ok': 'Refresh',
    'extension.invalidExthostReload.confirm.cancel': 'Ignore and continue to use',
    'extension.crashedExthostReload.confirm': 'Extension Host Process is crashed, do you want to restart the process?',
    'extension.exthostRestarting.content': 'Extension Host Process is restarting',
    'extension.host.restart': 'Restart Extension Host Process',

    'extension.no.view.found':
      'The view component registered with the plugin {0} could not be found. \n Please make sure that the component named {1} has been exported from the plugin.',
    'extension.profilingExtensionHost': 'Profiling Extension Host',
    'extension.profiling.clickStop': 'Click to stop profiling.',
    'extension.profile.save': 'Save Extension Host Profile',
    'extension.label': '{0} (Extension)',

    comments: 'Comments',
    'comments.reply.placeholder': 'Reply',
    'comments.participants': 'Participants',
    'comments.zone.title': 'Start Discussion',
    'comments.panel.action.collapse': 'Collapse All',
    'comments.thread.action.close': 'Close Panel',
    'comments.thread.action.openFile': 'Open file',
    'comments.thread.action.next': 'Next Comment',
    'comments.thread.action.previous': 'Previous Comment',
    'comments.thread.action.reply': 'Reply',
    'comments.panel.placeholder': 'No Comments',
    'comments.thread.textarea.write': 'Write',
    'comments.thread.textarea.preview': 'Preview',

    'treeview.command.action.collapse': 'Collapse ALL',

    'task.outputchannel.name': 'Task',
    'task.label': '{0}: {1}',
    'TaskService.pickRunTask': 'Select the task to run',
    'TerminalTaskSystem.terminalName': 'Task - {0}',
    'terminal.integrated.exitedWithCode': 'The terminal process terminated with exit code: {0}',
    'terminal.reuseTerminal': 'Terminal will be reused by tasks, press any key to close it.',

    'toolbar-customize.buttonDisplay.description': 'Button Style',
    'toolbar-customize.buttonDisplay.icon': 'Icon Only',
    'toolbar-customize.buttonDisplay.iconAndText': 'Icon And Text',
    'toolbar-customize.complete': 'Complete',
    'toolbar.customize.menu': 'Customize Toolbar...',

    'workbench.uploadingFiles': '{0} Files Uploading {1}/s',
    'workspace.development.title': 'Extension Development Host',
    'workbench.testViewContainer': 'Test',
    'workbench.hideSlotTabBarWhenHidePanel': 'Hide bottom slot tab bar when hide bottom panel',

    'variable.list.all': 'Variables: List All',
    'variable.registered.variables': 'Registered variables',

    'main-layout.left-panel.toggle': 'Toggle Left Side Bar',
    'main-layout.left-panel.show': 'Show Left Side Bar',
    'main-layout.left-panel.hide': 'Hide Left Side Bar',
    'main-layout.sidebar.hide': 'Hide Side Bar',
    'main-layout.right-panel.toggle': 'Toggle Right Side Bar',
    'main-layout.right-panel.show': 'Show Right Side Bar',
    'main-layout.right-panel.hide': 'Hide Right Side Bar',
    'main-layout.bottom-panel.toggle': 'Toggle Bottom Side Bar',
    'main-layout.bottom-panel.show': 'Show Bottom Side Bar',
    'main-layout.bottom-panel.hide': 'Hide Bottom Side Bar',
    'main-layout.drop-area.tip': 'drop here',

    'refactor-preview.title': 'REFACTOR PREVIEW',
    'refactor-preview.title.clear': 'Discard Refactoring',
    'refactor-preview.title.apply': 'Apply Refactoring',
    'refactor-preview.overlay.title': 'Another refactoring is being previewed.',
    'refactor-preview.overlay.detail':
      "Press 'Continue' to discard the previous refactoring and continue with the current refactoring.",
    'refactor-preview.overlay.continue': 'Continue',
    'refactor-preview.overlay.cancel': 'Cancel',
    'refactor-preview.file.create': 'Creating',
    'refactor-preview.file.delete': 'Deleting',
    'refactor-preview.file.move': 'Moving',

    'welcome-view.noOpenRepo': 'No source control providers registered.',
    'welcome-view.noFolderHelp': 'You have not yet opened a folder.\n[Open Folder](command:{0})',
    'welcome-view.noLaunchJson':
      'No debug configuration detected.\n[Create Debug Configuration](command:{0})\n\nRun with Automatic Debug Configurations\n[Show All Automatic Debug Configurations](command:{1})',

    'authentication.manageTrustedExtensions': 'Manage Trusted Extensions',
    'authentication.manageExtensions': 'Choose which extensions can access this account',
    'authentication.noTrustedExtensions': 'This account has not been used by any extensions.',
    'authentication.accountLastUsedDate': 'Last used this account',
    'authentication.notUsed': 'Has not used this account',
    'authentication.signOutMessage': 'The account {0} has been used by: \n\n{1}\n\n Sign out of these features?',
    'authentication.signOutMessageSimple': 'Sign out of {0}?',
    'authentication.useOtherAccount': 'Sign in to another account',
    'authentication.selectAccount': "The extension '{0}' wants to access a {1} account",
    'authentication.getSessionPlaceholder': "Select an account for '{0}' to use or Esc to cancel",
    'authentication.confirmAuthenticationAccess': "The extension '{0}' wants to access the {1} account '{2}'.",
    'authentication.confirmLogin': "The extension '{0}' wants to sign in using {1}.",
    'authentication.confirmReLogin': "The extension '{0}' wants to sign in again using {1}.",
    'authentication.signInRequests': 'Sign in to use {0} (1)',
    'authentication.signOut': 'Sign out {0}',
    'authentication.noAccounts': 'You are not signed in to any accounts',
    'authentication.signedOut': 'Successfully signed out.',
    // refactoring changes related
    'refactoring-changes.ask.1.create': "Extension '{0}' wants to make refactoring changes with this file creation",
    'refactoring-changes.ask.1.copy': "Extension '{0}' wants to make refactoring changes with this file copy",
    'refactoring-changes.ask.1.move': "Extension '{0}' wants to make refactoring changes with this file move",
    'refactoring-changes.ask.1.delete': "Extension '{0}' wants to make refactoring changes with this file deletion",
    'refactoring-changes.ask.N.create': '{0} extensions want to make refactoring changes with this file creation',
    'refactoring-changes.ask.N.copy': '{0} extensions want to make refactoring changes with this file copy',
    'refactoring-changes.ask.N.move': '{0} extensions want to make refactoring changes with this file move',
    'refactoring-changes.ask.N.delete': '{0} extensions want to make refactoring changes with this file deletion',

    'refactoring-changes.msg.showPreview': 'Show Preview',
    'refactoring-changes.msg.skipChanges': 'Skip Changes',

    'keyboard.chooseKeyboardLayout': 'Choose keyboard layout',
    'keyboard.autoDetect.label': 'Auto Detect',
    'keyboard.autoDetect.description': "(Current: '{0} ')",
    'keyboard.autoDetect.detail': 'Try to detect the keyboard layout from browser information and pressed keys.',

    'editor.toggleWordWrap': 'Toggle Word Wrap',

    'editor.suggest.details.visible': 'Controls whether editor code completion expands details by default',

    'view.component.renderedError': 'View Component Rendering Exception',
    'view.component.tryAgain': 'Refresh',

    // #region Testing
    'test.title': 'Testing',
    'test.result.runFinished': 'Test run at {0}',
    'test.task.unnamed': 'Unnamed Task',
    'test.results': 'Test Results',

    // #endregion
    'menu.missing.command': 'menuId {0} register command not exist: {1}',
    'menu.missing.altCommand': 'menuId {0} register altCommand not exist: {1}',
    'menu.dupe.command': 'menuId {0} register command({1}) is duplicated with alt({2})',

    'command.category.developerTools': 'Developer Tool',

    'connection.start.rtt': 'Measure Connection RTT',
    'connection.stop.rtt': 'Stop Connection RTT',

    'debug.terminal.label': 'Javascript Debug Terminal',
    'debug.terminal.title': 'Debug Process',

    'output.channel.clear': 'Clear Output Panel',

    'workbench.action.tasks.runTask': 'Run Task',
    'workbench.action.tasks.reRunTask': 'Rerun Last Task',
    'workbench.action.tasks.restartTask': 'Restart Running Task',
    'workbench.action.tasks.terminate': 'Terminate Task',
    'workbench.action.tasks.showTasks': 'Show Running Tasks',
    'workbench.action.tasks.showLog': 'Show Task Log',
    'task.contribute': 'Contribute',
    'task.cannotFindTask': 'Cannot find task for {0}. Press Enter key to return.',

    'comment.reply.count': '{0} comments',
    'comment.reply.lastReply': 'Last reply from {0}',

    // extension contribute

    // #region walkthrough
    'walkthroughs.welcome': 'Welcome',
    'walkthroughs.get.started': "Open the 'Getting Started' walkthrough",
    // #endregion walkthrough

    // #region merge editor
    'mergeEditor.reset': 'Reset',
    'mergeEditor.workbench.tab.name': 'Merging: {0}',
    'mergeEditor.conflict.action.apply.confirm.title':
      'The file has unresolved conflicts or changes, whether to apply and save the changes?',
    'mergeEditor.conflict.action.apply.confirm.continue': 'Continue Merge',
    'mergeEditor.conflict.action.apply.confirm.complete': 'Apply Changes',
    'mergeEditor.action.button.apply': 'Apply',
    'mergeEditor.action.button.apply-and-stash': 'Apply and Stash',
    'mergeEditor.action.button.accept.left': 'Accept Left',
    'mergeEditor.action.button.accept.right': 'Accept Right',
    'mergeEditor.open.3way': '3-Way Editor',
    'mergeEditor.conflict.prev': 'Previous Conflict',
    'mergeEditor.conflict.next': 'Next Conflict',
    'mergeEditor.conflict.ai.resolve.all': 'AI Resolution',
    'mergeEditor.conflict.ai.resolve.all.stop': 'Stop All',
    'mergeEditor.open.tradition': 'Text Editor',

    // #region AI Native
    'aiNative.chat.ai.assistant.name': 'AI Assistant',
    'aiNative.chat.input.placeholder.default': 'Ask Copilot or type / for commands',
    'aiNative.chat.stop.immediately': 'I don’t think about it anymore. If you need anything, you can ask me anytime.',
    'aiNative.chat.error.response':
      'There are too many people interacting with me at the moment. Please try again later. Thank you for your understanding and support.',
    'aiNative.chat.code.insert': 'Insert code',
    'aiNative.chat.code.copy': 'Copy code',
    'aiNative.chat.code.copy.success': 'Copied successfully',
    'aiNative.chat.expand.unfullscreen': 'unfullscreen',
    'aiNative.chat.expand.fullescreen': 'fullescreen',
    'aiNative.chat.enter.send': 'Send (Enter)',

    'aiNative.inline.chat.operate.chat.title': 'Chat({0})',
    'aiNative.inline.chat.operate.check.title': 'Check',
    'aiNative.inline.chat.operate.thumbsup.title': 'Thumbs up',
    'aiNative.inline.chat.operate.thumbsdown.title': 'Thumbs down',
    'aiNative.inline.chat.operate.loading.cancel': 'Esc to cancel',
    'aiNative.inline.chat.input.placeholder.default': 'New code instructions...(↑↓ for history)',
    'aiNative.inline.chat.generating.canceled': 'Inline Chat Generating Canceled.',

    'aiNative.inline.hint.widget.placeholder': '{0} to inline chat',
    'aiNative.inline.problem.fix.title': 'Fix with AI',
    'aiNative.inline.diff.accept': 'Accept',
    'aiNative.inline.diff.reject': 'Reject',

    'aiNative.resolve.conflict.dialog.afresh': 'Are you sure you want to regenerate?',
    'aiNative.resolve.conflict.dialog.detection':
      'It is detected that you have made modifications. Regeneration will overwrite\nyour modifications. Are you sure to regenerate?',
    'aiNative.resolve.conflict.message.not.processed.yet':
      'AI has processed conflicts at {0}, but conflicts at {1} have not yet been processed (still marked as yellow) and require manual processing.',

    'aiNative.operate.discard.title': 'Discard',
    'aiNative.operate.afresh.title': 'Afresh',
    'aiNative.operate.stop.title': 'Stop',
    'aiNative.operate.close.title': 'Close',
    'aiNative.operate.clear.title': 'Clear',
    'aiNative.operate.tools.title': 'MCP Tools',
    'aiNative.operate.newChat.title': 'New Chat',
    'aiNative.operate.chatHistory.title': 'Chat History',
    'aiNative.operate.chatHistory.searchPlaceholder': 'Search Chats...',
    'aiNative.operate.chatHistory.edit': 'Edit',
    'aiNative.operate.chatHistory.delete': 'Delete',

    'aiNative.chat.welcome.loading.text': 'Initializing...',
    'aiNative.chat.ai.assistant.limit.message': '{0} earliest messages are dropped due to the input token limit',
    'aiNative.inlineDiff.acceptAll': 'Accept All',
    'aiNative.inlineDiff.rejectAll': 'Reject All',
    'aiNative.inlineDiff.reveal': 'Reveal In Chat',
    'aiNative.inlineDiff.up': 'Previous Change',
    'aiNative.inlineDiff.down': 'Next Change',
    'aiNative.inlineDiff.right': 'Next File',
    'aiNative.inlineDiff.left': 'Previous File',
    'aiNative.inlineDiff.noMoreChangesUp': 'No more changes above',
    'aiNative.inlineDiff.noMoreChangesDown': 'No more changes below',
    'aiNative.chat.session.max': 'You can only create {0} chats at a time',
    'preference.ai.native.inlineChat.title': 'Inline Chat',
    'preference.ai.native.chat.title': 'Chat',
    'preference.ai.native.interface.quick.title': 'Interface Quick Navigation',
    'preference.ai.native.interface.quick.navigation':
      'Click the icon on the left side of the editor to quickly jump to the interface implementation.',
    'preference.ai.native.interface.quick.navigation.hover': 'Go to implementation',
    'preference.ai.native.inlineChat.auto.visible': 'Does Inline Chat automatically appear when code are selected?',
    'preference.ai.native.inlineChat.codeAction.enabled':
      'Does Inline Chat related code actions automatically appear when code are selected?',
    'preference.ai.native.chat.visible.type': 'Control how the chat panel is displayed by default',

    'preference.ai.native.inlineDiff.preview.mode': 'Inline Diff preview mode',
    'preference.ai.native.inlineDiff.preview.mode.sideBySide': 'Displayed in the editor as left and right diff panels',
    'preference.ai.native.inlineDiff.preview.mode.inlineLive': 'Displayed in the editor through streaming rendering',

    'preference.ai.native.intelligentCompletions.title': 'Intelligent Completions',
    'preference.ai.native.intelligentCompletions.promptEngineering.enabled':
      'Whether to enable prompt engineering, some LLM models may not perform well on prompt engineering.',
    'preference.ai.native.intelligentCompletions.debounceTime': 'Debounce time for intelligent completions',
    'preference.ai.native.intelligentCompletions.cache.enabled': 'Whether to enable cache for intelligent completions',
    'preference.ai.native.intelligentCompletions.alwaysVisible': 'Whether to always show intelligent completions',

    'preference.ai.native.codeEdits.title': 'Code Edits',
    'preference.ai.native.codeEdits.lintErrors': 'Whether to trigger intelligent rewriting when Lint Error occurs',
    'preference.ai.native.codeEdits.lineChange':
      'Whether to trigger intelligent rewriting when the cursor line number changes',
    'preference.ai.native.codeEdits.typing': 'Whether to trigger intelligent rewriting when the content changes',
    'preference.ai.native.codeEdits.renderType': 'Code Edits Render Type',

    'preference.ai.native.chat.system.prompt': 'Default Chat System Prompt',
    // #endregion AI Native

    // #endregion merge editor
    'workbench.quickOpen.preserveInput':
      'Controls whether the last typed input to Quick Open(include Command Palette) should be preserved.',

    'webview.webviewTagUnavailable': 'webview is unsupported on non-electron env, please use iframe instead',

    // #region notebook
    'notebook.kernel.panel.empty': 'No content found.',
    'notebook.kernel.panel.title': 'Running Terminals and Kernels',
    'notebook.kernel.panel.opened.pages': 'Opened Pages',
    'notebook.kernel.panel.running.kernels': 'Running Kernels',
    'notebook.kernel.close.all.confirmation': 'Are you sure you want to close all?',
    'notebook.variable.panel.title': 'Variable Inspector',
    'notebook.variable.panel.unsupported': 'The file format is not supported for variable inspection',
    'notebook.variable.panel.refresh.success': 'Variable refresh successful',
    'notebook.variable.panel.refresh.error': 'Variable refresh failed',
    'notebook.variable.panel.search.placeholder': 'Please enter the variable name to search',
    'notebook.variable.panel.show.detail': 'View details',
    // #endregion notebook

    ...browserViews,
    ...editorLocalizations,
    ...mergeConflicts,

    // AI Native Settings
    'preference.ai.native.llm.apiSettings.title': 'LLM API Settings',
    'preference.ai.native.llm.model.id': 'Model ID',
    'preference.ai.native.deepseek.apiKey': 'Deepseek API Key',
    'preference.ai.native.deepseek.apiKey.description': 'API key for Deepseek language model',
    'preference.ai.native.anthropic.apiKey': 'Anthropic API Key',
    'preference.ai.native.anthropic.apiKey.description': 'API key for Anthropic language model',
    'preference.ai.native.openai.apiKey': 'OpenAI API Key',
    'preference.ai.native.openai.apiKey.description': 'API key for OpenAI Compatible language model',
    'preference.ai.native.openai.baseURL': 'OpenAI Base URL',
    'preference.ai.native.openai.baseURL.description': 'Base URL for OpenAI Compatible language model',

    // MCP Server Settings
    'preference.ai.native.mcp.settings.title': 'MCP Server Settings',
    'preference.ai.native.mcp.servers': 'MCP Servers',
    'preference.ai.native.mcp.servers.description': 'Configure MCP (Model Context Protocol) servers',
    'preference.ai.native.mcp.servers.name.description': 'Name of the MCP server',
    'preference.ai.native.mcp.servers.command.description': 'Command to start the MCP server',
    'preference.ai.native.mcp.servers.args.description': 'Command line arguments for the MCP server',
    'preference.ai.native.mcp.servers.env.description': 'Environment variables for the MCP server',
    'preference.ai.native.mcp.servers.type.description': 'Type of the MCP server connection',
    'preference.ai.native.mcp.servers.type.stdio': 'Stdio connection',
    'preference.ai.native.mcp.servers.type.sse': 'SSE connection',

    // MCP Terminal Tool
    'ai.native.mcp.terminal.command': 'Command',
    'ai.native.mcp.terminal.output': 'Output',
    'ai.native.mcp.terminal.allow-question': 'Allow the terminal to run the command?',
    'ai.native.mcp.terminal.allow': 'Allow',
    'ai.native.mcp.terminal.deny': 'Reject',
  },
};
