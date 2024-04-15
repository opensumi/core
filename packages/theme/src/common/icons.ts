import { localize } from '@opensumi/ide-core-common';
import { Codicon, Sumicon } from '@opensumi/ide-core-common/lib/codicons';

// https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
export const codIconIdentifier = {
  'accounts-view-bar-icon': {
    defaults: Codicon.account,
    description: localize('account', 'Accounts icon in the view bar.'),
  },
  'breakpoints-activate': {
    defaults: Codicon.activateBreakpoints,
    description: localize('activateBreakpoints', 'Icon for the activate action in the breakpoints view.'),
  },
  'breakpoints-remove-all': {
    defaults: Codicon.closeAll,
    description: localize('closeAll', 'Icon for the Remove All action in the breakpoints view.'),
  },
  'breakpoints-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the breakpoints view.'),
  },
  'callhierarchy-incoming': {
    defaults: Codicon.callIncoming,
    description: localize('callIncoming', 'Icon for incoming calls in the call hierarchy view.'),
  },
  'callhierarchy-outgoing': {
    defaults: Codicon.callOutgoing,
    description: localize('callOutgoing', 'Icon for outgoing calls in the call hierarchy view.'),
  },
  'callstack-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the call stack view.'),
  },
  'callstack-view-session': {
    defaults: Codicon.bug,
    description: localize('bug', 'Icon for the session icon in the call stack view.'),
  },
  'chat-editor-label-icon': {
    defaults: Codicon.commentDiscussion,
    description: localize('commentDiscussion', 'Icon of the chat editor label.'),
  },
  'comments-view-icon': {
    defaults: Codicon.commentDiscussion,
    description: localize('commentDiscussion', 'View icon of the comments view.'),
  },
  'debug-breakpoint': {
    defaults: Codicon.debugBreakpoint,
    description: localize('debugBreakpoint', 'Icon for breakpoints.'),
  },
  'debug-breakpoint-conditional': {
    defaults: Codicon.debugBreakpointConditional,
    description: localize('debugBreakpointConditional', 'Icon for conditional breakpoints.'),
  },
  'debug-breakpoint-conditional-disabled': {
    defaults: Codicon.debugBreakpointConditionalDisabled,
    description: localize('debugBreakpointConditionalDisabled', 'Icon for disabled conditional breakpoints.'),
  },
  'debug-breakpoint-conditional-unverified': {
    defaults: Codicon.debugBreakpointConditionalUnverified,
    description: localize('debugBreakpointConditionalUnverified', 'Icon for unverified conditional breakpoints.'),
  },
  'debug-breakpoint-data': {
    defaults: Codicon.debugBreakpointData,
    description: localize('debugBreakpointData', 'Icon for data breakpoints.'),
  },
  'debug-breakpoint-data-disabled': {
    defaults: Codicon.debugBreakpointDataDisabled,
    description: localize('debugBreakpointDataDisabled', 'Icon for disabled data breakpoints.'),
  },
  'debug-breakpoint-data-unverified': {
    defaults: Codicon.debugBreakpointDataUnverified,
    description: localize('debugBreakpointDataUnverified', 'Icon for unverified data breakpoints.'),
  },
  'debug-breakpoint-disabled': {
    defaults: Codicon.debugBreakpointDisabled,
    description: localize('debugBreakpointDisabled', 'Icon for disabled breakpoints.'),
  },
  'debug-breakpoint-function': {
    defaults: Codicon.debugBreakpointFunction,
    description: localize('debugBreakpointFunction', 'Icon for function breakpoints.'),
  },
  'debug-breakpoint-function-disabled': {
    defaults: Codicon.debugBreakpointFunctionDisabled,
    description: localize('debugBreakpointFunctionDisabled', 'Icon for disabled function breakpoints.'),
  },
  'debug-breakpoint-function-unverified': {
    defaults: Codicon.debugBreakpointFunctionUnverified,
    description: localize('debugBreakpointFunctionUnverified', 'Icon for unverified function breakpoints.'),
  },
  'debug-breakpoint-log': {
    defaults: Codicon.debugBreakpointLog,
    description: localize('debugBreakpointLog', 'Icon for log breakpoints.'),
  },
  'debug-breakpoint-log-disabled': {
    defaults: Codicon.debugBreakpointLogDisabled,
    description: localize('debugBreakpointLogDisabled', 'Icon for disabled log breakpoint.'),
  },
  'debug-breakpoint-log-unverified': {
    defaults: Codicon.debugBreakpointLogUnverified,
    description: localize('debugBreakpointLogUnverified', 'Icon for unverified log breakpoints.'),
  },
  'debug-breakpoint-unsupported': {
    defaults: Codicon.debugBreakpointUnsupported,
    description: localize('debugBreakpointUnsupported', 'Icon for unsupported breakpoints.'),
  },
  'debug-breakpoint-unverified': {
    defaults: Codicon.debugBreakpointUnverified,
    description: localize('debugBreakpointUnverified', 'Icon for unverified breakpoints.'),
  },
  'debug-collapse-all': {
    defaults: Codicon.collapseAll,
    description: localize('collapseAll', 'Icon for the collapse all action in the debug views.'),
  },
  'debug-configure': {
    defaults: Codicon.gear,
    description: localize('gear', 'Icon for the debug configure action.'),
  },
  'debug-console': {
    defaults: Codicon.debugConsole,
    description: localize('debugConsole', 'Icon for the debug console open action.'),
  },
  'debug-console-clear-all': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', 'Icon for the clear all action in the debug console.'),
  },
  'debug-console-evaluation-input': {
    defaults: Codicon.arrowSmallRight,
    description: localize('arrowSmallRight', 'Icon for the debug evaluation input marker.'),
  },
  'debug-console-evaluation-prompt': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon for the debug evaluation prompt.'),
  },
  'debug-console-view-icon': {
    defaults: Codicon.debugConsole,
    description: localize('debugConsole', 'View icon of the debug console view.'),
  },
  'debug-continue': {
    defaults: Codicon.debugContinue,
    description: localize('debugContinue', 'Icon for the debug continue action.'),
  },
  'debug-disconnect': {
    defaults: Codicon.debugDisconnect,
    description: localize('debugDisconnect', 'Icon for the debug disconnect action.'),
  },
  'debug-gripper': {
    defaults: Codicon.gripper,
    description: localize('gripper', 'Icon for the debug bar gripper.'),
  },
  'debug-hint': {
    defaults: Codicon.debugHint,
    description: localize('debugHint', 'Icon for breakpoint hints shown on hover in editor glyph margin.'),
  },
  'debug-pause': {
    defaults: Codicon.debugPause,
    description: localize('debugPause', 'Icon for the debug pause action.'),
  },
  'debug-restart': {
    defaults: Codicon.debugRestart,
    description: localize('debugRestart', 'Icon for the debug restart action.'),
  },
  'debug-restart-frame': {
    defaults: Codicon.debugRestartFrame,
    description: localize('debugRestartFrame', 'Icon for the debug restart frame action.'),
  },
  'debug-reverse-continue': {
    defaults: Codicon.debugReverseContinue,
    description: localize('debugReverseContinue', 'Icon for the debug reverse continue action.'),
  },
  'debug-stackframe': {
    defaults: Codicon.debugStackframe,
    description: localize('debugStackframe', 'Icon for a stackframe shown in the editor glyph margin.'),
  },
  'debug-stackframe-focused': {
    defaults: Codicon.debugStackframeFocused,
    description: localize('debugStackframeFocused', 'Icon for a focused stackframe shown in the editor glyph margin.'),
  },
  'debug-start': {
    defaults: Codicon.debugStart,
    description: localize('debugStart', 'Icon for the debug start action.'),
  },
  'debug-step-back': {
    defaults: Codicon.debugStepBack,
    description: localize('debugStepBack', 'Icon for the debug step back action.'),
  },
  'debug-step-into': {
    defaults: Codicon.debugStepInto,
    description: localize('debugStepInto', 'Icon for the debug step into action.'),
  },
  'debug-step-out': {
    defaults: Codicon.debugStepOut,
    description: localize('debugStepOut', 'Icon for the debug step out action.'),
  },
  'debug-step-over': {
    defaults: Codicon.debugStepOver,
    description: localize('debugStepOver', 'Icon for the debug step over action.'),
  },
  'debug-stop': {
    defaults: Codicon.debugStop,
    description: localize('debugStop', 'Icon for the debug stop action.'),
  },
  'default-view-icon': {
    defaults: Codicon.window,
    description: localize('window', 'Default view icon.'),
  },
  'diff-editor-next-change': {
    defaults: Codicon.arrowDown,
    description: localize('arrowDown', 'Icon for the next change action in the diff editor.'),
  },
  'diff-editor-previous-change': {
    defaults: Codicon.arrowUp,
    description: localize('arrowUp', 'Icon for the previous change action in the diff editor.'),
  },
  'diff-editor-toggle-whitespace': {
    defaults: Codicon.whitespace,
    description: localize('whitespace', 'Icon for the toggle whitespace action in the diff editor.'),
  },
  'diff-insert': {
    defaults: Codicon.add,
    description: localize('add', 'Line decoration for inserts in the diff editor.'),
  },
  'diff-remove': {
    defaults: Codicon.remove,
    description: localize('remove', 'Line decoration for removals in the diff editor.'),
  },
  'diff-review-close': {
    defaults: Codicon.close,
    description: localize('close', "Icon for 'Close' in diff review."),
  },
  'diff-review-insert': {
    defaults: Codicon.add,
    description: localize('add', "Icon for 'Insert' in diff review."),
  },
  'diff-review-remove': {
    defaults: Codicon.remove,
    description: localize('remove', "Icon for 'Remove' in diff review."),
  },
  'disassembly-editor-label-icon': {
    defaults: Codicon.debug,
    description: localize('debug', 'Icon of the disassembly editor label.'),
  },
  'explorer-view-icon': {
    defaults: Codicon.files,
    description: localize('files', 'View icon of the explorer view.'),
  },
  'extensions-clear-search-results': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', "Icon for the 'Clear Search Result' action in the extensions view."),
  },
  'extensions-configure-recommended': {
    defaults: Codicon.pencil,
    description: localize('pencil', "Icon for the 'Configure Recommended Extensions' action in the extensions view."),
  },
  'extensions-editor-label-icon': {
    defaults: Codicon.extensions,
    description: localize('extensions', 'Icon of the extension editor label.'),
  },
  'extensions-filter': {
    defaults: Codicon.filter,
    description: localize('filter', "Icon for the 'Filter' action in the extensions view."),
  },
  'extensions-info-message': {
    defaults: Codicon.info,
    description: localize('info', 'Icon shown with an info message in the extensions editor.'),
  },
  'extensions-install-count': {
    defaults: Codicon.cloudDownload,
    description: localize(
      'cloudDownload',
      'Icon shown along with the install count in the extensions view and editor.',
    ),
  },
  'extensions-install-local-in-remote': {
    defaults: Codicon.cloudDownload,
    description: localize(
      'cloudDownload',
      "Icon for the 'Install Local Extension in Remote' action in the extensions view.",
    ),
  },
  'extensions-install-workspace-recommended': {
    defaults: Codicon.cloudDownload,
    description: localize(
      'cloudDownload',
      "Icon for the 'Install Workspace Recommended Extensions' action in the extensions view.",
    ),
  },
  'extensions-manage': {
    defaults: Codicon.gear,
    description: localize('gear', "Icon for the 'Manage' action in the extensions view."),
  },
  'extensions-rating': {
    defaults: Codicon.star,
    description: localize('star', 'Icon shown along with the rating in the extensions view and editor.'),
  },
  'extensions-refresh': {
    defaults: Codicon.refresh,
    description: localize('refresh', "Icon for the 'Refresh' action in the extensions view."),
  },
  'extensions-remote': {
    defaults: Codicon.remote,
    description: localize('remote', 'Icon to indicate that an extension is remote in the extensions view and editor.'),
  },
  'extensions-star-empty': {
    defaults: Codicon.starEmpty,
    description: localize('starEmpty', 'Empty star icon used for the rating in the extensions editor.'),
  },
  'extensions-star-full': {
    defaults: Codicon.starFull,
    description: localize('starFull', 'Full star icon used for the rating in the extensions editor.'),
  },
  'extensions-star-half': {
    defaults: Codicon.starHalf,
    description: localize('starHalf', 'Half star icon used for the rating in the extensions editor.'),
  },
  'extensions-sync-enabled': {
    defaults: Codicon.sync,
    description: localize('sync', 'Icon to indicate that an extension is synced.'),
  },
  'extensions-sync-ignored': {
    defaults: Codicon.syncIgnored,
    description: localize('syncIgnored', 'Icon to indicate that an extension is ignored when syncing.'),
  },
  'extensions-view-icon': {
    defaults: Codicon.extensions,
    description: localize('extensions', 'View icon of the extensions view.'),
  },
  'extensions-warning-message': {
    defaults: Codicon.warning,
    description: localize('warning', 'Icon shown with a warning message in the extensions editor.'),
  },
  'find-collapsed': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon to indicate that the editor find widget is collapsed.'),
  },
  'find-expanded': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon to indicate that the editor find widget is expanded.'),
  },
  'find-next-match': {
    defaults: Codicon.arrowDown,
    description: localize('arrowDown', "Icon for 'Find Next' in the editor find widget."),
  },
  'find-previous-match': {
    defaults: Codicon.arrowUp,
    description: localize('arrowUp', "Icon for 'Find Previous' in the editor find widget."),
  },
  'find-replace': {
    defaults: Codicon.replace,
    description: localize('replace', "Icon for 'Replace' in the editor find widget."),
  },
  'find-replace-all': {
    defaults: Codicon.replaceAll,
    description: localize('replaceAll', "Icon for 'Replace All' in the editor find widget."),
  },
  'find-selection': {
    defaults: Codicon.selection,
    description: localize('selection', "Icon for 'Find in Selection' in the editor find widget."),
  },
  'folding-collapsed': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon for collapsed ranges in the editor glyph margin.'),
  },
  'folding-expanded': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for expanded ranges in the editor glyph margin.'),
  },
  'getting-started-beginner': {
    defaults: Codicon.lightbulb,
    description: localize('lightbulb', 'Icon used for the beginner category of getting started'),
  },
  'getting-started-codespaces': {
    defaults: Codicon.github,
    description: localize('github', 'Icon used for the codespaces category of getting started'),
  },
  'getting-started-item-checked': {
    defaults: Codicon.passFilled,
    description: localize('passFilled', 'Used to represent getting started items which have been completed'),
  },
  'getting-started-item-unchecked': {
    defaults: Codicon.circleLargeOutline,
    description: localize(
      'circleLargeOutline',
      'Used to represent getting started items which have not been completed',
    ),
  },
  'getting-started-setup': {
    defaults: Codicon.heart,
    description: localize('heart', 'Icon used for the setup category of getting started'),
  },
  'goto-next-location': {
    defaults: Codicon.arrowDown,
    description: localize('arrowDown', 'Icon for goto next editor location.'),
  },
  'goto-previous-location': {
    defaults: Codicon.arrowUp,
    description: localize('arrowUp', 'Icon for goto previous editor location.'),
  },
  'keybindings-add': {
    defaults: Codicon.add,
    description: localize('add', 'Icon for the add action in the keybinding UI.'),
  },
  'keybindings-edit': {
    defaults: Codicon.edit,
    description: localize('edit', 'Icon for the edit action in the keybinding UI.'),
  },
  'keybindings-editor-label-icon': {
    defaults: Codicon.keyboard,
    description: localize('keyboard', 'Icon of the keybindings editor label.'),
  },
  'keybindings-record-keys': {
    defaults: Codicon.recordKeys,
    description: localize('recordKeys', "Icon for the 'record keys' action in the keybinding UI."),
  },
  'keybindings-sort': {
    defaults: Codicon.sortPrecedence,
    description: localize('sortPrecedence', "Icon for the 'sort by precedence' toggle in the keybinding UI."),
  },
  'loaded-scripts-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the loaded scripts view.'),
  },
  'marker-navigation-next': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for goto next marker.'),
  },
  'marker-navigation-previous': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon for goto previous marker.'),
  },
  'markers-view-filter': {
    defaults: Codicon.filter,
    description: localize('filter', 'Icon for the filter configuration in the markers view.'),
  },
  'markers-view-icon': {
    defaults: Codicon.warning,
    description: localize('warning', 'View icon of the markers view.'),
  },
  'markers-view-multi-line-collapsed': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon indicating that multiple lines are collapsed in the markers view.'),
  },
  'markers-view-multi-line-expanded': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon indicating that multiple lines are shown in the markers view.'),
  },
  // 'multi-diff-editor-label-icon': {
  //   defaults:Codicon.diffMultiple,
  //   description: localize('diffMultiple','Icon of the multi diff editor label.'),
  // },
  'notebook-clear': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', 'Icon to clear cell outputs in notebook editors.'),
  },
  'notebook-collapsed': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon to annotate a collapsed section in notebook editors.'),
  },
  'notebook-delete-cell': {
    defaults: Codicon.trash,
    description: localize('trash', 'Icon to delete a cell in notebook editors.'),
  },
  'notebook-edit': {
    defaults: Codicon.pencil,
    description: localize('pencil', 'Icon to edit a cell in notebook editors.'),
  },
  'notebook-execute': {
    defaults: Codicon.play,
    description: localize('play', 'Icon to execute in notebook editors.'),
  },
  'notebook-execute-all': {
    defaults: Codicon.runAll,
    description: localize('runAll', 'Icon to execute all cells in notebook editors.'),
  },
  'notebook-expanded': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon to annotate an expanded section in notebook editors.'),
  },
  'notebook-kernel-configure': {
    defaults: Codicon.settingsGear,
    description: localize('settingsGear', 'Configure icon in kernel configuration widget in notebook editors.'),
  },
  'notebook-kernel-select': {
    defaults: Codicon.serverEnvironment,
    description: localize('serverEnvironment', 'Configure icon to select a kernel in notebook editors.'),
  },
  'notebook-mimetype': {
    defaults: Codicon.code,
    description: localize('code', 'Icon for a mime type in notebook editors.'),
  },
  'notebook-move-down': {
    defaults: Codicon.arrowDown,
    description: localize('arrowDown', 'Icon to move down a cell in notebook editors.'),
  },
  'notebook-move-up': {
    defaults: Codicon.arrowUp,
    description: localize('arrowUp', 'Icon to move up a cell in notebook editors.'),
  },
  'notebook-open-as-text': {
    defaults: Codicon.fileCode,
    description: localize('fileCode', 'Icon to open the notebook in a text editor.'),
  },
  'notebook-render-output': {
    defaults: Codicon.preview,
    description: localize('preview', 'Icon to render output in diff editor.'),
  },
  'notebook-revert': {
    defaults: Codicon.discard,
    description: localize('discard', 'Icon to revert in notebook editors.'),
  },
  'notebook-split-cell': {
    defaults: Codicon.splitVertical,
    description: localize('splitVertical', 'Icon to split a cell in notebook editors.'),
  },
  'notebook-state-error': {
    defaults: Codicon.error,
    description: localize('error', 'Icon to indicate an error state in notebook editors.'),
  },
  'notebook-state-success': {
    defaults: Codicon.check,
    description: localize('check', 'Icon to indicate a success state in notebook editors.'),
  },
  'notebook-stop': {
    defaults: Codicon.primitiveSquare,
    description: localize('primitiveSquare', 'Icon to stop an execution in notebook editors.'),
  },
  'notebook-stop-edit': {
    defaults: Codicon.check,
    description: localize('check', 'Icon to stop editing a cell in notebook editors.'),
  },
  'notebook-unfold': {
    defaults: Codicon.unfold,
    description: localize('unfold', 'Icon to unfold a cell in notebook editors.'),
  },
  'notifications-clear': {
    defaults: Codicon.close,
    description: localize('close', 'Icon for the clear action in notifications.'),
  },
  'notifications-clear-all': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', 'Icon for the clear all action in notifications.'),
  },
  'notifications-collapse': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for the collapse action in notifications.'),
  },
  'notifications-configure': {
    defaults: Codicon.gear,
    description: localize('gear', 'Icon for the configure action in notifications.'),
  },
  'notifications-expand': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon for the expand action in notifications.'),
  },
  'notifications-hide': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for the hide action in notifications.'),
  },
  'open-editors-view-icon': {
    defaults: Codicon.book,
    description: localize('book', 'View icon of the open editors view.'),
  },
  'outline-view-icon': {
    defaults: Codicon.symbolClass,
    description: localize('symbolClass', 'View icon of the outline view.'),
  },
  'output-view-icon': {
    defaults: Codicon.output,
    description: localize('output', 'View icon of the output view.'),
  },
  'panel-close': {
    defaults: Codicon.close,
    description: localize('close', 'Icon to close a panel.'),
  },
  'panel-maximize': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon to maximize a panel.'),
  },
  'panel-restore': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon to restore a panel.'),
  },
  'parameter-hints-next': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for show next parameter hint.'),
  },
  'parameter-hints-previous': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon for show previous parameter hint.'),
  },
  'ports-forward-icon': {
    defaults: Codicon.plus,
    description: localize('plus', 'Icon for the forward action.'),
  },
  'ports-open-browser-icon': {
    defaults: Codicon.globe,
    description: localize('globe', 'Icon for the open browser action.'),
  },
  'ports-stop-forward-icon': {
    defaults: Codicon.x,
    description: localize('x', 'Icon for the stop forwarding action.'),
  },
  'ports-view-icon': {
    defaults: Codicon.plug,
    description: localize('plug', 'View icon of the remote ports view.'),
  },
  'preferences-clear-input': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', 'Icon for clear input in the settings and keybinding UI.'),
  },
  'preferences-open-settings': {
    defaults: Codicon.goToFile,
    description: localize('goToFile', 'Icon for open settings commands.'),
  },
  'private-ports-view-icon': {
    defaults: Codicon.lock,
    description: localize('lock', 'Icon representing a private remote port.'),
  },
  'public-ports-view-icon': {
    defaults: Codicon.eye,
    description: localize('eye', 'Icon representing a public remote port.'),
  },
  'refactor-preview-view-icon': {
    defaults: Codicon.lightbulb,
    description: localize('lightbulb', 'View icon of the refactor preview view.'),
  },
  'remote-explorer-documentation': {
    defaults: Codicon.book,
    description: localize('book', 'Documentation icon in the remote explorer view.'),
  },
  'remote-explorer-feedback': {
    defaults: Codicon.twitter,
    description: localize('twitter', 'Feedback icon in the remote explorer view.'),
  },
  'remote-explorer-get-started': {
    defaults: Codicon.star,
    description: localize('star', 'Getting started icon in the remote explorer view.'),
  },
  'remote-explorer-report-issues': {
    defaults: Codicon.comment,
    description: localize('comment', 'Report issue icon in the remote explorer view.'),
  },
  'remote-explorer-review-issues': {
    defaults: Codicon.issues,
    description: localize('issues', 'Review issue icon in the remote explorer view.'),
  },
  'remote-explorer-view-icon': {
    defaults: Codicon.remoteExplorer,
    description: localize('remoteExplorer', 'View icon of the remote explorer view.'),
  },
  'review-comment-collapse': {
    defaults: Codicon.chevronUp,
    description: localize('chevronUp', 'Icon to collapse a review comment.'),
  },
  'run-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the Run and Debug view.'),
  },
  'runtime-extensions-editor-label-icon': {
    defaults: Codicon.extensions,
    description: localize('extensions', 'Icon of the runtime extensions editor label.'),
  },
  'search-clear-results': {
    defaults: Codicon.clearAll,
    description: localize('clearAll', 'Icon for clear results in the search view.'),
  },
  'search-collapse-results': {
    defaults: Codicon.collapseAll,
    description: localize('collapseAll', 'Icon for collapse results in the search view.'),
  },
  'search-details': {
    defaults: Codicon.ellipsis,
    description: localize('ellipsis', 'Icon to make search details visible.'),
  },
  'search-editor-label-icon': {
    defaults: Codicon.search,
    description: localize('search', 'Icon of the search editor label.'),
  },
  'search-expand-results': {
    defaults: Codicon.expandAll,
    description: localize('expandAll', 'Icon for expand results in the search view.'),
  },
  'search-hide-replace': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon to collapse the replace section in the search view.'),
  },
  'search-new-editor': {
    defaults: Codicon.newFile,
    description: localize('newFile', 'Icon for the action to open a new search editor.'),
  },
  'search-refresh': {
    defaults: Codicon.refresh,
    description: localize('refresh', 'Icon for refresh in the search view.'),
  },
  'search-remove': {
    defaults: Codicon.close,
    description: localize('close', 'Icon to remove a search result.'),
  },
  'search-replace': {
    defaults: Codicon.replace,
    description: localize('replace', 'Icon for replace in the search view.'),
  },
  'search-replace-all': {
    defaults: Codicon.replaceAll,
    description: localize('replaceAll', 'Icon for replace all in the search view.'),
  },
  'search-show-context': {
    defaults: Codicon.listSelection,
    description: localize('listSelection', 'Icon for toggle the context in the search editor.'),
  },
  'search-show-replace': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon to expand the replace section in the search view.'),
  },
  'search-stop': {
    defaults: Codicon.searchStop,
    description: localize('searchStop', 'Icon for stop in the search view.'),
  },
  'search-view-icon': {
    defaults: Codicon.search,
    description: localize('search', 'View icon of the search view.'),
  },
  'settings-add': {
    defaults: Codicon.add,
    description: localize('add', 'Icon for the add action in the Settings UI.'),
  },
  'settings-discard': {
    defaults: Codicon.discard,
    description: localize('discard', 'Icon for the discard action in the Settings UI.'),
  },
  'settings-edit': {
    defaults: Codicon.edit,
    description: localize('edit', 'Icon for the edit action in the Settings UI.'),
  },
  'settings-editor-label-icon': {
    defaults: Codicon.settings,
    description: localize('settings', 'Icon of the settings editor label.'),
  },
  'settings-folder-dropdown': {
    defaults: Codicon.triangleDown,
    description: localize('triangleDown', 'Icon for the folder dropdown button in the split JSON Settings editor.'),
  },
  'settings-group-collapsed': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon for a collapsed section in the split JSON Settings editor.'),
  },
  'settings-group-expanded': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for an expanded section in the split JSON Settings editor.'),
  },
  'settings-more-action': {
    defaults: Codicon.gear,
    description: localize('gear', "Icon for the 'more actions' action in the Settings UI."),
  },
  'settings-remove': {
    defaults: Codicon.close,
    description: localize('close', 'Icon for the remove action in the Settings UI.'),
  },
  'settings-sync-view-icon': {
    defaults: Codicon.sync,
    description: localize('sync', 'View icon of the Settings Sync view.'),
  },
  'settings-view-bar-icon': {
    defaults: Codicon.settingsGear,
    description: localize('settingsGear', 'Settings icon in the view bar.'),
  },
  'source-control-view-icon': {
    defaults: Codicon.sourceControl,
    description: localize('sourceControl', 'View icon of the Source Control view.'),
  },
  'suggest-more-info': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon for more information in the suggest widget.'),
  },
  'tasks-list-configure': {
    defaults: Codicon.gear,
    description: localize('gear', 'Configuration icon in the tasks selection list.'),
  },
  'tasks-remove': {
    defaults: Codicon.close,
    description: localize('close', 'Icon for remove in the tasks selection list.'),
  },
  'terminal-kill': {
    defaults: Codicon.trash,
    description: localize('trash', 'Icon for killing a terminal instance.'),
  },
  'terminal-new': {
    defaults: Codicon.add,
    description: localize('add', 'Icon for creating a new terminal instance.'),
  },
  'terminal-rename': {
    defaults: Codicon.gear,
    description: localize('gear', 'Icon for rename in the terminal quick menu.'),
  },
  'terminal-view-icon': {
    defaults: Codicon.terminal,
    description: localize('terminal', 'View icon of the terminal view.'),
  },
  'test-view-icon': {
    defaults: Codicon.beaker,
    description: localize('beaker', 'View icon of the test view.'),
  },
  'testing-cancel-icon': {
    defaults: Codicon.close,
    description: localize('close', 'Icon to cancel ongoing test runs.'),
  },
  'testing-debug-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'Icon of the "debug test" action.'),
  },
  'testing-error-icon': {
    defaults: Codicon.warning,
    description: localize('warning', 'Icon shown for tests that have an error.'),
  },
  'testing-failed-icon': {
    defaults: Codicon.close,
    description: localize('close', 'Icon shown for tests that failed.'),
  },
  'testing-passed-icon': {
    defaults: Codicon.pass,
    description: localize('pass', 'Icon shown for tests that passed.'),
  },
  'testing-queued-icon': {
    defaults: Codicon.watch,
    description: localize('watch', 'Icon shown for tests that are queued.'),
  },
  'testing-run-all-icon': {
    defaults: Codicon.runAll,
    description: localize('runAll', 'Icon of the "run all tests" action.'),
  },
  'testing-run-icon': {
    defaults: Codicon.run,
    description: localize('run', 'Icon of the "run test" action.'),
  },
  'testing-show-as-list-icon': {
    defaults: Codicon.listTree,
    description: localize('listTree', 'Icon shown when the test explorer is disabled as a tree.'),
  },
  'testing-skipped-icon': {
    defaults: Codicon.debugStepOver,
    description: localize('debugStepOver', 'Icon shown for tests that are skipped.'),
  },
  'testing-unset-icon': {
    defaults: Codicon.circleOutline,
    description: localize('circleOutline', 'Icon shown for tests that are in an unset state.'),
  },
  'timeline-open': {
    defaults: Codicon.history,
    description: localize('history', 'Icon for the open timeline action.'),
  },
  'timeline-pin': {
    defaults: Codicon.pin,
    description: localize('pin', 'Icon for the pin timeline action.'),
  },
  'timeline-refresh': {
    defaults: Codicon.refresh,
    description: localize('refresh', 'Icon for the refresh timeline action.'),
  },
  'timeline-unpin': {
    defaults: Codicon.pinned,
    description: localize('pinned', 'Icon for the unpin timeline action.'),
  },
  'timeline-view-icon': {
    defaults: Codicon.history,
    description: localize('history', 'View icon of the timeline view.'),
  },
  'variables-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the variables view.'),
  },
  'view-pane-container-collapsed': {
    defaults: Codicon.chevronRight,
    description: localize('chevronRight', 'Icon for a collapsed view pane container.'),
  },
  'view-pane-container-expanded': {
    defaults: Codicon.chevronDown,
    description: localize('chevronDown', 'Icon for an expanded view pane container.'),
  },
  'watch-expressions-add': {
    defaults: Codicon.add,
    description: localize('add', 'Icon for the add action in the watch view.'),
  },
  'watch-expressions-add-function-breakpoint': {
    defaults: Codicon.add,
    description: localize('add', 'Icon for the add function breakpoint action in the watch view.'),
  },
  'watch-expressions-remove-all': {
    defaults: Codicon.closeAll,
    description: localize('closeAll', 'Icon for the Remove All action in the watch view.'),
  },
  'watch-view-icon': {
    defaults: Codicon.debugAlt,
    description: localize('debugAlt', 'View icon of the watch view.'),
  },
  'widget-close': {
    defaults: Codicon.close,
    description: localize('close', 'Icon for the close action in widgets.'),
  },
  'workspace-trust-editor-label-icon': {
    defaults: Codicon.shield,
    description: localize('shield', 'Icon of the workspace trust editor label.'),
  },
};

// TODO more icons
// 已覆盖绝大多数 默认 sumi 图标
// proxy to codicon
export const sumiIconIdentifier = {
  'sumi-explorer': {
    defaults: Sumicon.explorer,
    description: 'View icon in the Explorer view.',
  },
  'sumi-search': {
    defaults: Sumicon.search,
    description: 'View icon in the Search view.',
  },
  'sumi-debug': {
    defaults: Sumicon.debug,
    description: 'View icon in the Debug view.',
  },
  'sumi-scm': {
    defaults: Sumicon.scm,
    description: 'View icon in the Source Control  view.',
  },
  'sumi-extension': {
    defaults: Sumicon.extension,
    description: 'View icon in the Extension view.',
  },
  'sumi-embed': {
    defaults: Sumicon.embed,
  },
  'sumi-setting': {
    defaults: Sumicon.setting,
  },
  'sumi-sync': {
    defaults: Sumicon.sync,
  },
  'sumi-zsh': {
    defaults: Sumicon.zsh,
  },
  'sumi-bash': {
    defaults: Sumicon.bash,
  },
  'sumi-clear': {
    defaults: Sumicon.clear,
  },
  'sumi-new-file': {
    defaults: Sumicon.newFile,
  },
  'sumi-new-folder': {
    defaults: Sumicon.newFolder,
  },
  'sumi-refresh': {
    defaults: Sumicon.refresh,
  },
  'sumi-more': {
    defaults: Sumicon.more,
  },
  'sumi-open': {
    defaults: Sumicon.open,
  },
  'sumi-close': {
    defaults: Sumicon.close,
  },
  'sumi-delete': {
    defaults: Sumicon.delete,
  },
  'sumi-right': {
    defaults: Sumicon.right,
  },
  'sumi-left': {
    defaults: Sumicon.left,
  },
  'sumi-down': {
    defaults: Sumicon.down,
  },
  'sumi-up': {
    defaults: Sumicon.up,
  },
  'sumi-arrowright': {
    defaults: Sumicon.arrowRight,
  },
  'sumi-arrowleft': {
    defaults: Sumicon.arrowLeft,
  },
  'sumi-arrowdown': {
    defaults: Sumicon.arrowDown,
  },
  'sumi-arrowup': {
    defaults: Sumicon.arrowUp,
  },
  // TODO arrow-down arrow-right 需要改为 down right
  'sumi-arrow-right': {
    defaults: Sumicon.right,
  },
  'sumi-arrow-down': {
    defaults: Sumicon.down,
  },
  'sumi-start': {
    defaults: Sumicon.start,
  },
  'sumi-save-all': {
    defaults: Sumicon.saveAll,
  },
  'sumi-close-all': {
    defaults: Sumicon.closeAll,
  },
  'sumi-collapse-all': {
    defaults: Sumicon.collapseAll,
  },
  'sumi-expand-all': {
    defaults: Sumicon.expandAll,
  },
  'sumi-retrieval': {
    defaults: Sumicon.retrieval,
  },
  'sumi-eye-close': {
    defaults: Sumicon.eyeClose,
  },
  'sumi-ellipsis': {
    defaults: Sumicon.ellipsis,
  },
  'sumi-magic-wand': {
    defaults: Sumicon.magicWand,
  },
};
