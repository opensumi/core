import {
  localize,
  isOSX,
  isLinux,
  PreferenceSchema,
  PreferenceSchemaProperties,
  PreferenceProxy,
} from '@opensumi/ide-core-browser';

export const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

const DEFAULT_WINDOWS_FONT_FAMILY = "Consolas, 'Courier New', monospace";
const DEFAULT_MAC_FONT_FAMILY = "Menlo, Monaco, 'Courier New', monospace";
const DEFAULT_LINUX_FONT_FAMILY = "'Droid Sans Mono', 'monospace', monospace, 'Droid Sans Fallback'";

export const EDITOR_FONT_DEFAULTS = {
  fontFamily: isOSX ? DEFAULT_MAC_FONT_FAMILY : isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY,
  fontWeight: 'normal',
  fontSize: 12,
  tabSize: 2,
  renderWhitespace: false,
  cursorStyle: 'line',
  insertSpace: true,
  wordWrap: 'off',
  wordWrapColumn: 80,
  lineHeight: 0,
  letterSpacing: 0,
};

export const EDITOR_MODEL_DEFAULTS = {
  tabSize: 4,
  indentSize: 4,
  insertSpaces: true,
  detectIndentation: true,
  trimAutoWhitespace: true,
  largeFileOptimizations: true,
};

export const EDITOR_SUGGEST_DEFAULTS = {
  insertMode: 'insert',
  filterGraceful: true,
  snippetsPreventQuickSuggestions: true,
  localityBonus: false,
  shareSuggestSelections: false,
  showIcons: true,
  maxVisibleSuggestions: 12,
  showMethods: true,
  showFunctions: true,
  showConstructors: true,
  showFields: true,
  showVariables: true,
  showClasses: true,
  showStructs: true,
  showInterfaces: true,
  showModules: true,
  showProperties: true,
  showEvents: true,
  showOperators: true,
  showUnits: true,
  showValues: true,
  showConstants: true,
  showEnums: true,
  showEnumMembers: true,
  showKeywords: true,
  showWords: true,
  showColors: true,
  showFiles: true,
  showReferences: true,
  showFolders: true,
  showTypeParameters: true,
  showSnippets: true,
  showUsers: true,
  showIssues: true,
  detailsVisible: true,
  preview: true,
  statusBar: {
    visible: false,
  },
};

export const EDITOR_INLINE_SUGGEST_DEFAULTS = {
  enabled: true,
};

export const enum WrappingIndent {
  /**
   * No indentation => wrapped lines begin at column 1.
   */
  None = 0,
  /**
   * Same => wrapped lines get the same indentation as the parent.
   */
  Same = 1,
  /**
   * Indent => wrapped lines get +1 indentation toward the parent.
   */
  Indent = 2,
  /**
   * DeepIndent => wrapped lines get +2 indentation toward the parent.
   */
  DeepIndent = 3,
}

export const EDITOR_DEFAULTS = {
  inDiffEditor: false,
  wordSeparators: USUAL_WORD_SEPARATORS,
  lineNumbersMinChars: 3,
  lineDecorationsWidth: 10,
  readOnly: false,
  mouseStyle: 'text',
  disableLayerHinting: false,
  automaticLayout: true, // Modified
  wordWrap: 'off',
  wordWrapColumn: 80,
  wordWrapMinified: true,
  wrappingIndent: WrappingIndent.Same,
  wordWrapBreakBeforeCharacters: '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋',
  wordWrapBreakAfterCharacters:
    ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣',
  wordWrapBreakObtrusiveCharacters: '.',
  autoClosingBrackets: 'languageDefined',
  autoClosingQuotes: 'languageDefined',
  autoSurround: 'languageDefined',
  autoIndent: true,
  dragAndDrop: true,
  emptySelectionClipboard: true,
  copyWithSyntaxHighlighting: true,
  useTabStops: true,
  multiCursorModifier: 'altKey',
  multiCursorMergeOverlapping: true,
  accessibilitySupport: 'off',
  showUnused: true,
  wrappingStrategy: 'simple',

  viewInfo: {
    extraEditorClassName: '',
    disableMonospaceOptimizations: false,
    rulers: [],
    ariaLabel: localize('editorViewAccessibleLabel', 'Editor content'),
    renderLineNumbers: 0,
    renderCustomLineNumbers: null,
    renderFinalNewline: true,
    selectOnLineNumbers: true,
    glyphMargin: true,
    revealHorizontalRightPadding: 30,
    roundedSelection: true,
    overviewRulerLanes: 2,
    overviewRulerBorder: true,
    cursorBlinking: 1,
    mouseWheelZoom: false,
    cursorSmoothCaretAnimation: false,
    cursorStyle: 1,
    cursorWidth: 0,
    hideCursorInOverviewRuler: false,
    scrollBeyondLastLine: true,
    scrollBeyondLastColumn: 5,
    smoothScrolling: false,
    stopRenderingLineAfter: 10000,
    renderWhitespace: 'none',
    renderControlCharacters: false,
    fontLigatures: false,
    renderLineHighlight: 'none', // Modified
    scrollbar: {
      vertical: 1, // ScrollbarVisibility.Auto,
      horizontal: 1, // ScrollbarVisibility.Auto,
      arrowSize: 11,
      useShadows: true,
      verticalHasArrows: false,
      horizontalHasArrows: false,
      horizontalScrollbarSize: 10,
      horizontalSliderSize: 10,
      verticalScrollbarSize: 14,
      verticalSliderSize: 14,
      handleMouseWheel: true,
      mouseWheelScrollSensitivity: 1,
      fastScrollSensitivity: 5,
    },
    minimap: {
      enabled: true,
      side: 'right',
      showSlider: 'mouseover',
      renderCharacters: true,
      maxColumn: 120,
    },
    guides: {
      indentation: true,
      highlightActiveIndentGuide: true,
      bracketPairs: true,
    },
    fixedOverflowWidgets: true,
  },

  contribInfo: {
    selectionClipboard: true,
    hover: {
      enabled: true,
      delay: 300,
      sticky: true,
    },
    links: true,
    contextmenu: true,
    quickSuggestions: { other: true, comments: false, strings: false },
    quickSuggestionsDelay: 10,
    parameterHints: {
      enabled: true,
      cycle: false,
    },
    formatOnType: false,
    formatOnPaste: false,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    acceptSuggestionOnCommitCharacter: true,
    wordBasedSuggestions: false, // Modified
    suggestSelection: 'recentlyUsed',
    suggestFontSize: 0,
    suggestLineHeight: 0,
    tabCompletion: 'off',
    gotoLocation: {
      multiple: 'peek',
    },
    selectionHighlight: true,
    occurrencesHighlight: true,
    codeLens: true,
    folding: true,
    foldingStrategy: 'auto',
    showFoldingControls: 'mouseover',
    matchBrackets: true,
    find: {
      seedSearchStringFromSelection: true,
      autoFindInSelection: false,
      globalFindClipboard: false,
      addExtraSpaceOnTop: true,
    },
    colorDecorators: true,
    lightbulbEnabled: true,
    codeActionsOnSave: {},
    codeActionsOnSaveTimeout: 750,
  },
};

const monacoEditorSchema: PreferenceSchemaProperties = {
  'editor.ariaLabel': {
    type: 'string',
    default: EDITOR_DEFAULTS.viewInfo.ariaLabel,
    description: '%editor.configuration.ariaLabel%',
  },
  'editor.extraEditorClassName': {
    type: 'string',
    description: '%editor.configuration.extraEditorClassName%',
  },
  'editor.fixedOverflowWidgets': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.fixedOverflowWidgets,
    description: '%editor.configuration.fixedOverflowWidgets%',
  },
  'editor.revealHorizontalRightPadding': {
    type: 'number',
    description: '%editor.configuration.revealHorizontalRightPadding%',
  },
  'editor.selectOnLineNumbers': {
    type: 'boolean',
    description: '%editor.configuration.selectOnLineNumbers%',
  },
  'editor.wordWrapMinified': {
    type: 'boolean',
    description: '%editor.configuration.wordWrapMinified%',
  },
  'editor.wordWrapBreakAfterCharacters': {
    type: 'string',
    default:
      ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣',
    description: '%editor.configuration.wordWrapBreakAfterCharacters%',
  },
  'editor.wrappingStrategy': {
    type: 'string',
    enum: ['advanced', 'simple'],
    default: 'simple',
    description: '%editor.configuration.wrappingStrategy%',
  },
  'editor.wordWrapBreakBeforeCharacters': {
    type: 'string',
    default: '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋',
    description: '%editor.configuration.wordWrapBreakBeforeCharacters%',
  },
  'editor.lineNumbersMinChars': {
    type: 'number',
    default: EDITOR_DEFAULTS.lineNumbersMinChars,
    description: '%editor.configuration.lineNumbersMinChars%',
  },
  'editor.lineDecorationsWidth': {
    type: 'number',
    default: EDITOR_DEFAULTS.lineDecorationsWidth,
    description: '%editor.configuration.lineDecorationsWidth%',
  },
  'editor.fontFamily': {
    type: 'string',
    default: EDITOR_FONT_DEFAULTS.fontFamily,
    description: '%editor.configuration.fontFamily%',
  },
  'editor.fontWeight': {
    type: 'string',
    default: EDITOR_FONT_DEFAULTS.fontWeight,
    description: '%editor.configuration.fontWeight%',
  },
  'editor.fontSize': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.fontSize,
    description: localize('fontSize', 'Controls the font size in pixels.'),
  },
  'editor.lineHeight': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.lineHeight,
    description: localize(
      'lineHeight',
      'Controls the line height. Use 0 to compute the line height from the font size.',
    ),
  },
  'editor.suggest.insertMode': {
    type: 'string',
    enum: ['insert', 'replace'],
    enumDescriptions: [
      localize(
        'editor.configuration.suggest.insertMode.insert',
        'Insert suggestion without overwriting text right of the cursor.',
      ),
      localize(
        'editor.configuration.suggest.insertMode.replace',
        'Insert suggestion and overwrite text right of the cursor.',
      ),
    ],
    default: 'insert',
    description: '%editor.configuration.suggest.insertMode%',
  },
  'editor.suggest.filterGraceful': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.filterGraceful,
    description: '%editor.configuration.suggest.filterGraceful%',
  },
  'editor.suggest.localityBonus': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.localityBonus,
    description: '%editor.configuration.suggest.localityBonus%',
  },
  'editor.suggest.shareSuggestSelections': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.shareSuggestSelections,
    description: '%editor.configuration.suggest.shareSuggestSelections%',
  },
  'editor.suggest.snippetsPreventQuickSuggestions': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.snippetsPreventQuickSuggestions,
    description: '%editor.configuration.suggest.snippetsPreventQuickSuggestions%',
  },
  'editor.suggest.showIcons': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.showIcons,
    description: '%editor.configuration.suggest.showIcons%',
  },
  'editor.suggest.maxVisibleSuggestions': {
    type: 'number',
    default: EDITOR_SUGGEST_DEFAULTS.maxVisibleSuggestions,
    minimum: 1,
    maximum: 15,
    description: '%editor.configuration.suggest.maxVisibleSuggestions%',
  },
  'editor.suggest.showMethods': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showMethods%',
  },
  'editor.suggest.showFunctions': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showFunctions%',
  },
  'editor.suggest.showConstructors': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showConstructors%',
  },
  'editor.suggest.showFields': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showFields%',
  },
  'editor.suggest.showVariables': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showVariables%',
  },
  'editor.suggest.showClasses': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showClasss%',
  },
  'editor.suggest.showStructs': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showStructs%',
  },
  'editor.suggest.showInterfaces': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showInterfaces%',
  },
  'editor.suggest.showModules': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showModules%',
  },
  'editor.suggest.showProperties': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showPropertys%',
  },
  'editor.suggest.showEvents': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showEvents%',
  },
  'editor.suggest.showOperators': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showOperators%',
  },
  'editor.suggest.showUnits': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showUnits%',
  },
  'editor.suggest.showValues': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showValues%',
  },
  'editor.suggest.showConstants': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showConstants%',
  },
  'editor.suggest.showEnums': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showEnums%',
  },
  'editor.suggest.showEnumMembers': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showEnumMembers%',
  },
  'editor.suggest.showKeywords': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showKeywords%',
  },
  'editor.suggest.showWords': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showTexts%',
  },
  'editor.suggest.showColors': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showColors%',
  },
  'editor.suggest.showFiles': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showFiles%',
  },
  'editor.suggest.showReferences': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showReferences%',
  },
  'editor.suggest.showCustomcolors': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showCustomcolors%',
  },
  'editor.suggest.showFolders': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showFolders%',
  },
  'editor.suggest.showTypeParameters': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showTypeParameters%',
  },
  'editor.suggest.showSnippets': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showSnippets%',
  },
  'editor.suggest.showUsers': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showUsers%',
  },
  'editor.suggest.showIssues': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.suggest.showIssues%',
  },
  'editor.suggest.statusBar.visible': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.suggest.statusBar.visible%',
  },
  'editor.suggest.preview': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.preview,
    description: '%editor.configuration.suggest.preview%',
  },
  'editor.suggest.details.visible': {
    type: 'boolean',
    default: EDITOR_SUGGEST_DEFAULTS.detailsVisible,
    description: '%editor.configuration.suggest.details.visible%',
  },
  'editor.inlineSuggest.enabled': {
    type: 'boolean',
    default: EDITOR_INLINE_SUGGEST_DEFAULTS.enabled,
    description: '%editor.configuration.inlineSuggest.enabled%',
  },
  'editor.experimental.stickyScroll.enabled': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.experimental.stickyScroll%',
  },
  'editor.customCodeActionMenu.showHeaders': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.customCodeActionMenu.showHeaders',
  },
  'editor.useCustomCodeActionMenu': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.useCustomCodeActionMenu%',
  },
  'editor.letterSpacing': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.letterSpacing,
    description: '%editor.configuration.letterSpacing%',
  },
  'editor.lineNumbers': {
    type: 'string',
    enum: ['off', 'on', 'relative', 'interval'],
    enumDescriptions: [
      localize('editor.configuration.lineNumbers.off', 'Line numbers are not rendered.'),
      localize('editor.configuration.lineNumbers.on', 'Line numbers are rendered as absolute number.'),
      localize(
        'editor.configuration.lineNumbers.relative',
        'Line numbers are rendered as distance in lines to cursor position.',
      ),
      localize('editor.configuration.lineNumbers.interval', 'Line numbers are rendered every 10 lines.'),
    ],
    default: 'on',
    description: '%editor.configuration.lineNumbers%',
  },
  'editor.renderFinalNewline': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.renderFinalNewline,
    description: '%editor.configuration.renderFinalNewline%',
  },
  'editor.rulers': {
    type: 'array',
    items: {
      type: 'number',
    },
    default: EDITOR_DEFAULTS.viewInfo.rulers,
    description: '%editor.configuration.rulers%',
  },
  'editor.wordSeparators': {
    type: 'string',
    default: EDITOR_DEFAULTS.wordSeparators,
    description: '%editor.configuration.wordSeparators%',
  },
  'editor.tabSize': {
    type: 'number',
    default: EDITOR_MODEL_DEFAULTS.tabSize,
    minimum: 1,
    markdownDescription: '%editor.configuration.tabSize%',
  },
  // 'editor.indentSize': {
  // 	'anyOf': [
  // 		{
  // 			'type': 'string',
  // 			'enum': ['tabSize']
  // 		},
  // 		{
  // 			'type': 'number',
  // 			'minimum': 1
  // 		}
  // 	],
  // 	'default': 'tabSize',
  // 	'markdownDescription': localize('indentSize', "The number of spaces used for indentation or 'tabSize' to use the value from `#editor.tabSize#`. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.")
  // },
  'editor.insertSpaces': {
    type: 'boolean',
    default: EDITOR_MODEL_DEFAULTS.insertSpaces,
    markdownDescription: '%editor.configuration.insertSpaces%',
  },
  'editor.detectIndentation': {
    type: 'boolean',
    default: EDITOR_MODEL_DEFAULTS.detectIndentation,
    markdownDescription: '%editor.configuration.detectIndentation%',
  },
  'editor.roundedSelection': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.roundedSelection,
    description: '%editor.configuration.roundedSelection%',
  },
  'editor.scrollBeyondLastLine': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.scrollBeyondLastLine,
    description: '%editor.configuration.scrollBeyondLastLine%',
  },
  'editor.scrollBeyondLastColumn': {
    type: 'number',
    default: EDITOR_DEFAULTS.viewInfo.scrollBeyondLastColumn,
    description: '%editor.configuration.scrollBeyondLastColumn%',
  },
  'editor.smoothScrolling': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.smoothScrolling,
    description: '%editor.configuration.smoothScrolling%',
  },
  'editor.minimap.enabled': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.minimap.enabled,
    description: '%editor.configuration.minimap.enabled%',
  },
  'editor.minimap.side': {
    type: 'string',
    enum: ['left', 'right'],
    default: EDITOR_DEFAULTS.viewInfo.minimap.side,
    description: '%editor.configuration.minimap.side%',
  },
  'editor.minimap.showSlider': {
    type: 'string',
    enum: ['always', 'mouseover'],
    default: EDITOR_DEFAULTS.viewInfo.minimap.showSlider,
    description: '%editor.configuration.minimap.showSlider%',
  },
  'editor.minimap.renderCharacters': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.minimap.renderCharacters,
    description: '%editor.configuration.minimap.renderCharacters%',
  },
  'editor.minimap.maxColumn': {
    type: 'number',
    default: EDITOR_DEFAULTS.viewInfo.minimap.maxColumn,
    description: '%editor.configuration.minimap.maxColumn%',
  },
  'editor.hover.enabled': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.hover.enabled,
    description: '%editor.configuration.hover.enabled%',
  },
  'editor.hover.delay': {
    type: 'number',
    default: EDITOR_DEFAULTS.contribInfo.hover.delay,
    description: localize('hover.delay', 'Controls the delay in milliseconds after which the hover is shown.'),
  },
  'editor.hover.sticky': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.hover.sticky,
    description: '%editor.configuration.hover.sticky%',
  },
  'editor.find.seedSearchStringFromSelection': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.find.seedSearchStringFromSelection,
    description: '%editor.configuration.find.seedSearchStringFromSelection%',
  },
  'editor.find.autoFindInSelection': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.find.autoFindInSelection,
    description: '%editor.configuration.find.autoFindInSelection%',
  },
  'editor.find.globalFindClipboard': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.find.globalFindClipboard,
    description: '%editor.configuration.find.globalFindClipboard%',
    included: isOSX,
  },
  'editor.find.addExtraSpaceOnTop': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.find.addExtraSpaceOnTop%',
  },
  'editor.wordWrap': {
    type: 'string',
    enum: ['off', 'on', 'wordWrapColumn', 'bounded'],
    markdownEnumDescriptions: [
      localize('editor.configuration.wordWrap.off', 'Lines will never wrap.'),
      localize('editor.configuration.wordWrap.on', 'Lines will wrap at the viewport width.'),
      localize('editor.configuration.wordWrap.wordWrapColumn', 'Lines will wrap at `#editor.wordWrapColumn#`.'),
      localize(
        'editor.configuration.wordWrap.bounded',
        'Lines will wrap at the minimum of viewport and `#editor.wordWrapColumn#`.',
      ),
    ],
    default: EDITOR_DEFAULTS.wordWrap,
    description: '%editor.configuration.wordWrap%',
  },
  'editor.wordWrapColumn': {
    type: 'integer',
    default: EDITOR_DEFAULTS.wordWrapColumn,
    minimum: 1,
    markdownDescription: '%editor.configuration.wordWrapColumn%',
  },
  'editor.wrappingIndent': {
    type: 'string',
    enum: ['none', 'same', 'indent', 'deepIndent'],
    enumDescriptions: [
      localize('editor.configuration.wrappingIndent.none', 'No indentation. Wrapped lines begin at column 1.'),
      localize('editor.configuration.wrappingIndent.same', 'Wrapped lines get the same indentation as the parent.'),
      localize('editor.configuration.wrappingIndent.indent', 'Wrapped lines get +1 indentation toward the parent.'),
      localize('editor.configuration.wrappingIndent.deepIndent', 'Wrapped lines get +2 indentation toward the parent.'),
    ],
    default: 'same',
    description: '%editor.configuration.wrappingIndent%',
  },
  'editor.mouseWheelScrollSensitivity': {
    type: 'number',
    default: EDITOR_DEFAULTS.viewInfo.scrollbar.mouseWheelScrollSensitivity,
    markdownDescription: '%editor.configuration.mouseWheelScrollSensitivity%',
  },
  'editor.fastScrollSensitivity': {
    type: 'number',
    default: EDITOR_DEFAULTS.viewInfo.scrollbar.fastScrollSensitivity,
    markdownDescription: '%editor.configuration.fastScrollSensitivity%',
  },
  'editor.multiCursorModifier': {
    type: 'string',
    enum: ['ctrlCmd', 'alt'],
    markdownEnumDescriptions: [
      localize(
        'editor.configuration.multiCursorModifier.ctrlCmd',
        'Maps to `Control` on Windows and Linux and to `Command` on macOS.',
      ),
      localize(
        'editor.configuration.multiCursorModifier.alt',
        'Maps to `Alt` on Windows and Linux and to `Option` on macOS.',
      ),
    ],
    default: 'alt',
    markdownDescription: localize(
      'multiCursorModifier',
      'The modifier to be used to add multiple cursors with the mouse. The Go To Definition and Open Link mouse gestures will adapt such that they do not conflict with the multicursor modifier. [Read more](https://code.visualstudio.com/docs/editor/codebasics#_multicursor-modifier).',
    ),
  },
  'editor.multiCursorMergeOverlapping': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.multiCursorMergeOverlapping,
    description: '%editor.configuration.multiCursorMergeOverlapping%',
  },
  'editor.quickSuggestions': {
    anyOf: [
      {
        type: 'boolean',
      },
      {
        type: 'object',
        properties: {
          strings: {
            type: 'boolean',
            default: false,
            description: localize(
              'editor.configuration.quickSuggestions.strings',
              'Enable quick suggestions inside strings.',
            ),
          },
          comments: {
            type: 'boolean',
            default: false,
            description: localize(
              'editor.configuration.quickSuggestions.comments',
              'Enable quick suggestions inside comments.',
            ),
          },
          other: {
            type: 'boolean',
            default: true,
            description: '%editor.configuration.quickSuggestions.other%',
          },
        },
      },
    ],
    default: EDITOR_DEFAULTS.contribInfo.quickSuggestions,
    description: '%editor.configuration.quickSuggestions%',
  },
  'editor.quickSuggestionsDelay': {
    type: 'integer',
    default: EDITOR_DEFAULTS.contribInfo.quickSuggestionsDelay,
    minimum: 0,
    description: '%editor.configuration.quickSuggestionsDelay%',
  },
  'editor.parameterHints.enabled': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.parameterHints.enabled,
    description: '%editor.configuration.parameterHints.enabled%',
  },
  'editor.parameterHints.cycle': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.parameterHints.cycle,
    description: '%editor.configuration.parameterHints.cycle%',
  },
  'editor.autoClosingBrackets': {
    type: 'string',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
    enumDescriptions: [
      '',
      localize(
        'editor.configuration.autoClosingBrackets.languageDefined',
        'Use language configurations to determine when to autoclose brackets.',
      ),
      localize(
        'editor.configuration.autoClosingBrackets.beforeWhitespace',
        'Autoclose brackets only when the cursor is to the left of whitespace.',
      ),
      '',
    ],
    default: EDITOR_DEFAULTS.autoClosingBrackets,
    description: '%editor.configuration.autoClosingBrackets%',
  },
  'editor.autoClosingQuotes': {
    type: 'string',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
    enumDescriptions: [
      '',
      localize(
        'editor.configuration.autoClosingQuotes.languageDefined',
        'Use language configurations to determine when to autoclose quotes.',
      ),
      localize(
        'editor.configuration.autoClosingQuotes.beforeWhitespace',
        'Autoclose quotes only when the cursor is to the left of whitespace.',
      ),
      '',
    ],
    default: EDITOR_DEFAULTS.autoClosingQuotes,
    description: '%editor.configuration.autoClosingQuotes%',
  },
  'editor.autoSurround': {
    type: 'string',
    enum: ['languageDefined', 'brackets', 'quotes', 'never'],
    enumDescriptions: [
      localize(
        'editor.configuration.autoSurround.languageDefined',
        'Use language configurations to determine when to automatically surround selections.',
      ),
      localize('editor.configuration.autoSurround.brackets', 'Surround with brackets but not quotes.'),
      localize('editor.configuration.autoSurround.quotes', 'Surround with quotes but not brackets.'),
      '',
    ],
    default: EDITOR_DEFAULTS.autoSurround,
    description: '%editor.configuration.autoSurround%',
  },
  'editor.formatOnType': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.formatOnType,
    description: '%editor.configuration.formatOnType%',
  },
  'editor.formatOnPaste': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.formatOnPaste,
    description: '%editor.configuration.formatOnPaste%',
  },
  'editor.autoIndent': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.autoIndent,
    description: '%editor.configuration.autoIndent%',
  },
  'editor.suggestOnTriggerCharacters': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.suggestOnTriggerCharacters,
    description: '%editor.configuration.suggestOnTriggerCharacters%',
  },
  'editor.acceptSuggestionOnEnter': {
    type: 'string',
    enum: ['on', 'smart', 'off'],
    default: EDITOR_DEFAULTS.contribInfo.acceptSuggestionOnEnter,
    markdownEnumDescriptions: [
      '',
      localize(
        'editor.configuration.acceptSuggestionOnEnterSmart',
        'Only accept a suggestion with `Enter` when it makes a textual change.',
      ),
      '',
    ],
    markdownDescription: localize(
      'editor.configuration.acceptSuggestionOnEnter',
      'Controls whether suggestions should be accepted on `Enter`, in addition to `Tab`. Helps to avoid ambiguity between inserting new lines or accepting suggestions.',
    ),
  },
  'editor.acceptSuggestionOnCommitCharacter': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.acceptSuggestionOnCommitCharacter,
    markdownDescription: localize(
      'editor.configuration.acceptSuggestionOnCommitCharacter',
      'Controls whether suggestions should be accepted on commit characters. For example, in JavaScript, the semi-colon (`;`) can be a commit character that accepts a suggestion and types that character.',
    ),
  },
  'editor.snippetSuggestions': {
    type: 'string',
    enum: ['top', 'bottom', 'inline', 'none'],
    enumDescriptions: [
      localize('editor.configuration.snippetSuggestions.top', 'Show snippet suggestions on top of other suggestions.'),
      localize('editor.configuration.snippetSuggestions.bottom', 'Show snippet suggestions below other suggestions.'),
      localize('editor.configuration.snippetSuggestions.inline', 'Show snippets suggestions with other suggestions.'),
      localize('editor.configuration.snippetSuggestions.none', 'Do not show snippet suggestions.'),
    ],
    default: 'inline',
    description: '%editor.configuration.snippetSuggestions%',
  },
  'editor.emptySelectionClipboard': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.emptySelectionClipboard,
    description: '%editor.configuration.emptySelectionClipboard%',
  },
  'editor.copyWithSyntaxHighlighting': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.copyWithSyntaxHighlighting,
    description: '%editor.configuration.copyWithSyntaxHighlighting%',
  },
  'editor.wordBasedSuggestions': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.wordBasedSuggestions,
    description: '%editor.configuration.wordBasedSuggestions%',
  },
  'editor.suggestSelection': {
    type: 'string',
    enum: ['first', 'recentlyUsed', 'recentlyUsedByPrefix'],
    markdownEnumDescriptions: [
      localize('editor.configuration.suggestSelection.first', 'Always select the first suggestion.'),
      localize(
        'editor.configuration.suggestSelection.recentlyUsed',
        'Select recent suggestions unless further typing selects one, e.g. `console.| -> console.log` because `log` has been completed recently.',
      ),
      localize(
        'editor.configuration.suggestSelection.recentlyUsedByPrefix',
        'Select suggestions based on previous prefixes that have completed those suggestions, e.g. `co -> console` and `con -> const`.',
      ),
    ],
    default: 'recentlyUsed',
    description: '%editor.configuration.suggestSelection%',
  },
  'editor.suggestFontSize': {
    type: 'integer',
    default: 0,
    minimum: 0,
    markdownDescription: '%editor.configuration.suggestFontSize%',
  },
  'editor.suggestLineHeight': {
    type: 'integer',
    default: 0,
    minimum: 0,
    markdownDescription: '%editor.configuration.suggestLineHeight%',
  },
  'editor.tabCompletion': {
    type: 'string',
    default: 'off',
    enum: ['on', 'off', 'onlySnippets'],
    enumDescriptions: [
      localize(
        'editor.configuration.tabCompletion.on',
        'Tab complete will insert the best matching suggestion when pressing tab.',
      ),
      localize('editor.configuration.tabCompletion.off', 'Disable tab completions.'),
      localize(
        'editor.configuration.tabCompletion.onlySnippets',
        "Tab complete snippets when their prefix match. Works best when 'quickSuggestions' aren't enabled.",
      ),
    ],
    description: '%editor.configuration.tabCompletion%',
  },
  'editor.suggest.filteredTypes': {
    type: 'object',
    default: { keyword: true, snippet: true },
    markdownDescription: '%editor.configuration.suggest.filtered%',
    properties: {
      method: {
        type: 'boolean',
        default: true,
        markdownDescription: localize(
          'editor.configuration.suggest.filtered.method',
          'When set to `false` IntelliSense never shows `method` suggestions.',
        ),
      },
      function: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.function%',
      },
      constructor: {
        type: 'boolean' as const,
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.constructor%',
      },
      field: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.field%',
      },
      variable: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.variable%',
      },
      class: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.class%',
      },
      struct: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.struct%',
      },
      interface: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.interface%',
      },
      module: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.module%',
      },
      property: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.property%',
      },
      event: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.event%',
      },
      operator: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.operator%',
      },
      unit: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.unit%',
      },
      value: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.value',
      },
      constant: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.constant%',
      },
      enum: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.enum%',
      },
      enumMember: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.enumMember%',
      },
      keyword: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.keyword%',
      },
      text: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.text%',
      },
      color: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.color%',
      },
      file: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.file%',
      },
      reference: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.reference%',
      },
      customcolor: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.customcolor%',
      },
      folder: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.folder%',
      },
      typeParameter: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.typeParameter%',
      },
      snippet: {
        type: 'boolean',
        default: true,
        markdownDescription: '%editor.configuration.suggest.filtered.snippet%',
      },
    },
  },
  'editor.gotoLocation.multiple': {
    description: '%editor.configuration.editor.gotoLocation.multiple%',
    type: 'string',
    enum: ['peek', 'gotoAndPeek', 'goto'],
    default: EDITOR_DEFAULTS.contribInfo.gotoLocation.multiple,
    enumDescriptions: [
      localize('editor.configuration.gotoLocation.multiple.peek', 'Show peek view of the results (default)'),
      localize(
        'editor.configuration.gotoLocation.multiple.gotoAndPeek',
        'Go to the primary result and show a peek view',
      ),
      localize(
        'editor.configuration.gotoLocation.multiple.goto',
        'Go to the primary result and enable peek-less navigation to others',
      ),
    ],
  },
  'editor.selectionHighlight': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.selectionHighlight,
    description: '%editor.configuration.selectionHighlight%',
  },
  'editor.occurrencesHighlight': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.occurrencesHighlight,
    description: '%editor.configuration.occurrencesHighlight%',
  },
  'editor.overviewRulerLanes': {
    type: 'integer',
    default: 3,
    description: '%editor.configuration.overviewRulerLanes%',
  },
  'editor.overviewRulerBorder': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.overviewRulerBorder,
    description: '%editor.configuration.overviewRulerBorder%',
  },
  'editor.cursorBlinking': {
    type: 'string',
    enum: ['blink', 'smooth', 'phase', 'expand', 'solid'],
    default: 'blink',
    description: '%editor.configuration.cursorBlinking%',
  },
  'editor.mouseWheelZoom': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.mouseWheelZoom,
    markdownDescription: '%editor.configuration.mouseWheelZoom%',
  },
  'editor.cursorSmoothCaretAnimation': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.cursorSmoothCaretAnimation,
    description: '%editor.configuration.cursorSmoothCaretAnimation%',
  },
  'editor.cursorStyle': {
    type: 'string',
    enum: ['block', 'block-outline', 'line', 'line-thin', 'underline', 'underline-thin'],
    default: EDITOR_FONT_DEFAULTS.cursorStyle,
    description: '%editor.configuration.cursorStyle%',
  },
  'editor.cursorWidth': {
    type: 'integer',
    default: EDITOR_DEFAULTS.viewInfo.cursorWidth,
    markdownDescription: '%editor.configuration.cursorWidth%',
  },
  'editor.fontLigatures': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.fontLigatures,
    description: '%editor.configuration.fontLigatures%',
  },
  'editor.hideCursorInOverviewRuler': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.hideCursorInOverviewRuler,
    description: '%editor.configuration.hideCursorInOverviewRuler%',
  },
  'editor.renderWhitespace': {
    type: 'string',
    enum: ['none', 'boundary', 'selection', 'all'],
    enumDescriptions: [
      '',
      localize(
        'editor.configuration.renderWhitespace.boundary',
        'Render whitespace characters except for single spaces between words.',
      ),
      localize(
        'editor.configuration.renderWhitespace.selection',
        'Render whitespace characters only on selected text.',
      ),
      '',
    ],
    default: EDITOR_DEFAULTS.viewInfo.renderWhitespace,
    description: '%editor.configuration.renderWhitespace%',
  },
  'editor.rename.enablePreview': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.rename.enablePreview%',
  },
  'editor.renderControlCharacters': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.renderControlCharacters,
    description: '%editor.configuration.renderControlCharacters%',
  },
  'editor.guides.indentation': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.guides.indentation,
    description: '%editor.configuration.guides.indentation%',
  },
  'editor.guides.highlightActiveIndentation': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.guides.highlightActiveIndentGuide,
    description: '%editor.configuration.guides.highlightActiveIndentation%',
  },
  'editor.guides.bracketPairs': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.guides.bracketPairs,
    description: '%editor.configuration.guides.bracketPairs%',
  },
  'editor.renderLineHighlight': {
    type: 'string',
    enum: ['none', 'gutter', 'line', 'all'],
    enumDescriptions: [
      '',
      '',
      '',
      localize('editor.configuration.renderLineHighlight.all', 'Highlights both the gutter and the current line.'),
    ],
    default: EDITOR_DEFAULTS.viewInfo.renderLineHighlight,
    description: '%editor.configuration.renderLineHighlight%',
  },
  'editor.codeLens': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.codeLens,
    description: '%editor.configuration.codeLens%',
  },
  'editor.folding': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.folding,
    description: '%editor.configuration.folding%',
  },
  'editor.foldingStrategy': {
    type: 'string',
    enum: ['auto', 'indentation'],
    default: EDITOR_DEFAULTS.contribInfo.foldingStrategy,
    markdownDescription: '%editor.configuration.foldingStrategy%',
  },
  'editor.showFoldingControls': {
    type: 'string',
    enum: ['always', 'mouseover'],
    default: EDITOR_DEFAULTS.contribInfo.showFoldingControls,
    description: '%editor.configuration.showFoldingControls%',
  },
  'editor.matchBrackets': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.matchBrackets,
    description: '%editor.configuration.matchBrackets%',
  },
  'editor.glyphMargin': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.glyphMargin,
    description: '%editor.configuration.glyphMargin%',
  },
  'editor.useTabStops': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.useTabStops,
    description: '%editor.configuration.useTabStops%',
  },
  'editor.trimAutoWhitespace': {
    type: 'boolean',
    default: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
    description: '%editor.configuration.trimAutoWhitespace%',
  },
  'editor.stablePeek': {
    type: 'boolean',
    default: false,
    markdownDescription: '%editor.configuration.stablePeek%',
  },
  'editor.dragAndDrop': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.dragAndDrop,
    description: '%editor.configuration.dragAndDrop%',
  },
  'editor.accessibilitySupport': {
    type: 'string',
    enum: ['auto', 'on', 'off'],
    enumDescriptions: [
      localize(
        'editor.configuration.accessibilitySupport.auto',
        'The editor will use platform APIs to detect when a Screen Reader is attached.',
      ),
      localize(
        'editor.configuration.accessibilitySupport.on',
        'The editor will be permanently optimized for usage with a Screen Reader.',
      ),
      localize(
        'editor.configuration.accessibilitySupport.off',
        'The editor will never be optimized for usage with a Screen Reader.',
      ),
    ],
    default: EDITOR_DEFAULTS.accessibilitySupport,
    description: localize(
      'accessibilitySupport',
      'Controls whether the editor should run in a mode where it is optimized for screen readers.',
    ),
  },
  'editor.showUnused': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.showUnused,
    description: '%editor.configuration.showUnused%',
  },
  'editor.comments.insertSpace': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.comments.insertSpace%',
  },
  'editor.comments.ignoreEmptyLines': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.comments.ignoreEmptyLines%',
  },
  'editor.links': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.links,
    description: '%editor.configuration.links%',
  },
  'editor.colorDecorators': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.colorDecorators,
    description: '%editor.configuration.colorDecorators%',
  },
  'editor.lightbulb.enabled': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.lightbulbEnabled,
    description: '%editor.configuration.lightbulb.enabled%',
  },
  'editor.maxTokenizationLineLength': {
    type: 'integer',
    default: 20000,
    description: '%editor.configuration.maxTokenizationLineLength%',
  },
  'editor.codeActionsOnSave': {
    type: 'object',
    properties: {
      'source.organizeImports': {
        type: 'boolean',
        description: '%editor.configuration.codeActionsOnSave.organizeImports%',
      },
      'source.fixAll': {
        type: 'boolean',
        description: '%editor.configuration.codeActionsOnSave.fixAll%',
      },
    },
    additionalProperties: {
      type: 'boolean',
    },
    default: EDITOR_DEFAULTS.contribInfo.codeActionsOnSave,
    description: '%editor.configuration.codeActionsOnSave%',
  },
  'editor.codeActionsOnSaveTimeout': {
    type: 'number',
    default: EDITOR_DEFAULTS.contribInfo.codeActionsOnSaveTimeout,
    description: '%editor.configuration.codeActionsOnSaveTimeout%',
  },
  'editor.codeActionsOnSaveNotification': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.codeActionsOnSaveNotification%',
  },
  'editor.selectionClipboard': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.selectionClipboard,
    description: '%editor.configuration.selectionClipboard%',
    included: isLinux,
  },
  'editor.largeFileOptimizations': {
    type: 'boolean',
    default: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
    description: '%editor.configuration.largeFileOptimizations%',
  },
  'diffEditor.renderIndicators': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.renderIndicators%',
  },
  'diffEditor.minimap': {
    type: 'boolean',
    default: false,
  },
  'editor.defaultFormatter': {
    type: 'string',
    description: '%editor.configuration.defaultFormatter%',
  },
  'editor.unicodeHighlight.ambiguousCharacters': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.unicodeHighlight.ambiguousCharacters%',
  },
};

const customEditorSchema: PreferenceSchemaProperties = {
  'editor.tokenColorCustomizations': {
    type: 'object',
    description: '%editor.configuration.tokenColorCustomizations%',
    default: {},
  },
  'editor.askIfDiff': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.askIfDiff%',
  },
  'editor.showActionWhenGroupEmpty': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.showActionWhenGroupEmpty%',
  },
  'editor.autoSave': {
    type: 'string',
    enum: ['off', 'afterDelay', 'editorFocusChange', 'windowLostFocus'],
    default: 'off',
    description: '%editor.configuration.autoSave%',
  },
  'editor.autoSaveDelay': {
    type: 'number',
    default: 1000,
    markdownDescription: '%editor.configuration.autoSaveDelay%',
  },
  'editor.preferredFormatter': {
    type: 'object',
    default: {},
    description: '%editor.configuration.preferredFormatter%',
  },
  'editor.previewMode': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.previewMode%',
  },
  'editor.wrapTab': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.wrapTab%',
  },
  'editor.enablePreviewFromCodeNavigation': {
    type: 'boolean',
    default: false,
    markdownDescription: '%editor.configuration.enablePreviewFromCodeNavigation%',
  },
  'editor.minimap': {
    type: 'boolean',
    default: true,
  },
  'editor.forceReadOnly': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.forceReadOnly%',
  },
  // 会启用 languageFeature 的最大文件尺寸
  'editor.languageFeatureEnabledMaxSize': {
    type: 'number',
    default: 4 * 1024 * 1024 * 1024, // 4096 MB
    description: '%editor.configuration.languageFeatureEnabledMaxSize%',
  },
  // 会同步到插件进程的最大文件尺寸, 必须大于等于 languageFeatureEnabledMaxSize
  'editor.docExtHostSyncMaxSize': {
    type: 'number',
    default: 4 * 1024 * 1024 * 1024, // 4096 MB
    description: '%editor.configuration.docExtHostSyncMaxSize%',
  },
  'editor.renderLineHighlight': {
    type: 'string',
    enum: ['none', 'gutter', 'line', 'all'],
    default: 'all',
    description: '%editor.configuration.renderLineHighlight%',
  },
  'editor.fontFamily': {
    type: 'string',
    default: EDITOR_FONT_DEFAULTS.fontFamily,
  },
  'editor.fontSize': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.fontSize,
    minimum: 6,
  },
  'editor.tabSize': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.tabSize,
    minimum: 1,
    description: '%editor.configuration.tabSize%',
  },
  'editor.formatOnPaste': {
    type: 'boolean',
    default: false,
  },
  'editor.detectIndentation': {
    type: 'boolean',
    default: true,
  },
  'editor.renderWhitespace': {
    type: 'boolean',
    default: EDITOR_FONT_DEFAULTS.renderWhitespace,
  },
  'editor.cursorStyle': {
    type: 'string',
    enum: ['line', 'block', 'block-outline', 'line-thin', 'underline', 'underline-thin'],
    default: EDITOR_FONT_DEFAULTS.cursorStyle,
  },
  'editor.insertSpaces': {
    type: 'boolean',
    default: EDITOR_FONT_DEFAULTS.insertSpace,
  },
  'editor.wordWrap': {
    type: 'string',
    enum: ['off', 'on'],
    default: EDITOR_FONT_DEFAULTS.wordWrap,
  },
  'editor.wordWrapColumn': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.wordWrapColumn,
    description: '%editor.configuration.wordWrapColumn%',
  },
  'editor.readonlyFiles': {
    type: 'array',
    default: [],
    items: {
      type: 'string',
    },
  },
  'editor.formatOnSave': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.formatOnSave%',
  },
  'editor.formatOnSaveTimeout': {
    type: 'number',
    default: 750,
    markdownDescription: '%editor.configuration.formatOnSaveTimeout%',
  },
  'editor.lineHeight': {
    type: 'number',
    default: 0,
    description: '%editor.lineHeight.description%',
  },
  'editor.maxTokenizationLineLength': {
    type: 'integer',
    default: 20000,
    description: '%editor.configuration.maxTokenizationLineLength%',
  },
  'editor.semanticHighlighting.enabled': {
    enum: [true, false, 'configuredByTheme'],
    enumDescriptions: [
      localize('editor.configuration.semanticHighlighting.true', 'Semantic highlighting enabled for all color themes.'),
      localize(
        'editor.configuration.semanticHighlighting.false',
        'Semantic highlighting disabled for all color themes.',
      ),
      localize(
        'editor.configuration.semanticHighlighting.configuredByTheme',
        "Semantic highlighting is configured by the current color theme's `semanticHighlighting` setting.",
      ),
    ],
    default: true,
    description: '%editor.configuration.semanticHighlighting.enabled%',
  },
  'editor.bracketPairColorization.enabled': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.bracketPairColorization.enabled%',
  },
  'editor.largeFile': {
    type: 'number',
    default: 4 * 1024 * 1024 * 1024,
    description: '%editor.configuration.largeFileSize%',
  },
  'editor.quickSuggestionsDelay': {
    type: 'integer',
    default: 100,
    description: '%editor.configuration.quickSuggestionsDelay%',
  },
  'editor.modelDisposeTime': {
    type: 'integer',
    default: 3000,
  },
  'workbench.editorAssociations': {
    type: 'object',
    markdownDescription: '%editor.configuration.workbench.editorAssociations%',
    default: {},
    additionalProperties: {
      type: 'string',
    },
  },
  'diffEditor.renderSideBySide': {
    type: 'boolean',
    default: true,
    description: '%diffEditor.configuration.renderSideBySide%',
  },
  'diffEditor.ignoreTrimWhitespace': {
    type: 'boolean',
    default: false,
    description: '%diffEditor.configuration.ignoreTrimWhitespace%',
  },
  'editor.experimental.stickyScroll.enabled': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.experimental.stickyScroll.enabled%',
  },
  'editor.mouseBackForwardToNavigate': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.mouseBackForwardToNavigate%',
  },
};

export const editorPreferenceSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    ...monacoEditorSchema,
    ...customEditorSchema,
  },
};

export const EditorPreferences = Symbol('EditorPreference');
export type EditorPreferences = PreferenceProxy<{
  'editor.readonlyFiles': string[];
  'editor.previewMode': boolean;
  'editor.autoSaveDelay': number;
  'editor.autoSave': string;
}>;
