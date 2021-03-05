import { localize, isOSX, isLinux, PreferenceSchema, PreferenceSchemaProperties, PreferenceProxy } from '@ali/ide-core-browser';

export const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

const DEFAULT_WINDOWS_FONT_FAMILY = 'Consolas, \'Courier New\', monospace';
const DEFAULT_MAC_FONT_FAMILY = 'Menlo, Monaco, \'Courier New\', monospace';
const DEFAULT_LINUX_FONT_FAMILY = '\'Droid Sans Mono\', \'monospace\', monospace, \'Droid Sans Fallback\'';

export const EDITOR_FONT_DEFAULTS = {
  fontFamily: (
    isOSX ? DEFAULT_MAC_FONT_FAMILY : (isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY)
  ),
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
  lineNumbersMinChars: 5,
  lineDecorationsWidth: 10,
  readOnly: false,
  mouseStyle: 'text',
  disableLayerHinting: false,
  automaticLayout: true, // 开天修改
  wordWrap: 'off',
  wordWrapColumn: 80,
  wordWrapMinified: true,
  wrappingIndent: WrappingIndent.Same,
  wordWrapBreakBeforeCharacters: '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋',
  wordWrapBreakAfterCharacters: ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣',
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
  accessibilitySupport: 'auto',
  showUnused: true,
  wrappingStrategy: 'advanced',

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
    renderIndentGuides: true,
    highlightActiveIndentGuide: true,
    renderLineHighlight: 'none', // 开天修改
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
    fixedOverflowWidgets: false,
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
    wordBasedSuggestions: false, // 开天修改
    suggestSelection: 'recentlyUsed',
    suggestFontSize: 0,
    suggestLineHeight: 0,
    tabCompletion: 'off',
    suggest: {
      filterGraceful: true,
      snippets: 'inline',
      snippetsPreventQuickSuggestions: true,
      localityBonus: false,
      shareSuggestSelections: false,
      showIcons: true,
      maxVisibleSuggestions: 12,
      filteredTypes: Object.create(null),
    },
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
    'type': 'string',
    'default': EDITOR_DEFAULTS.viewInfo.ariaLabel,
    'description': localize('ariaLabel', "The aria label for the editor's textarea (when it is focused)."),
  },
  'editor.extraEditorClassName': {
    'type': 'string',
    'description': localize('extraEditorClassName', 'Class name to be added to the editor.'),
  },
  'editor.fixedOverflowWidgets': {
    'type': 'boolean',
    'description': localize('fixedOverflowWidgets', 'Display overflow widgets as fixed. Defaults to false.'),
  },
  'editor.revealHorizontalRightPadding': {
    'type': 'number',
    'description': localize('revealHorizontalRightPadding', 'When revealing the cursor, a virtual padding (px) is added to the cursor, turning it into a rectangle. This virtual padding ensures that the cursor gets revealed before hitting the edge of the viewport. Defaults to 30 (px).'),
  },
  'editor.selectOnLineNumbers': {
    'type': 'boolean',
    'description': localize('selectOnLineNumbers', 'Should the corresponding line be selected when clicking on the line number? Defaults to true.'),
  },
  'editor.wordWrapMinified': {
    'type': 'boolean',
    'description': localize('wordWrapMinified', 'Force word wrapping when the text appears to be of a minified/generated file. Defaults to true.'),
  },
  'editor.wordWrapBreakAfterCharacters': {
    'type': 'string',
    'description': localize('wordWrapBreakAfterCharacters', "Configure word wrapping characters. A break will be introduced after these characters. Defaults to ' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣'."),
  },
  'editor.wrappingStrategy': {
    'type': 'string',
    'enum': ['advanced', 'simple'],
    /**
     * wrappingStrategy 默认值为 simple，即假定所有字符的宽度相等，但在包含中文的情况下，会导致陷入死循环
     * advanced 是借助 dom 来计算，但算法整体会比较慢，可能会导致大文件下性能有一定消耗，但这里可以暂时修复 simple 带来的问题
     */
    'default': 'advanced',
    'description': localize('wrappingStrategy', 'Controls the algorithm that computes wrapping points.'),
  },
  'editor.wordWrapBreakBeforeCharacters': {
    'type': 'string',
    'description': localize('wordWrapBreakBeforeCharacters', "Configure word wrapping characters. A break will be introduced before these characters. Defaults to '([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋'."),
  },
  'editor.lineNumbersMinChars': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.lineNumbersMinChars,
    'description': localize('lineNumbersMinChars', 'Control the width of line numbers, by reserving horizontal space for rendering at least an amount of digits. Defaults to 5.'),
  },
  'editor.lineDecorationsWidth': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.lineDecorationsWidth,
    'description': localize('lineDecorationsWidth', 'The width reserved for line decorations (in px). Line decorations are placed between line numbers and the editor content. You can pass in a string in the format floating point followed by "ch". e.g. 1.3ch. Defaults to 10.'),
  },
  'editor.fontFamily': {
    'type': 'string',
    'default': EDITOR_FONT_DEFAULTS.fontFamily,
    'description': localize('fontFamily', 'Controls the font family.'),
  },
  'editor.fontWeight': {
    'type': 'string',
    'enum': ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    'default': EDITOR_FONT_DEFAULTS.fontWeight,
    'description': localize('fontWeight', 'Controls the font weight.'),
  },
  'editor.fontSize': {
    'type': 'number',
    'default': EDITOR_FONT_DEFAULTS.fontSize,
    'description': localize('fontSize', 'Controls the font size in pixels.'),
  },
  'editor.lineHeight': {
    'type': 'number',
    'default': EDITOR_FONT_DEFAULTS.lineHeight,
    'description': localize('lineHeight', 'Controls the line height. Use 0 to compute the line height from the font size.'),
  },
  'editor.letterSpacing': {
    'type': 'number',
    'default': EDITOR_FONT_DEFAULTS.letterSpacing,
    'description': localize('letterSpacing', 'Controls the letter spacing in pixels.'),
  },
  'editor.lineNumbers': {
    'type': 'string',
    'enum': ['off', 'on', 'relative', 'interval'],
    'enumDescriptions': [
      localize('lineNumbers.off', 'Line numbers are not rendered.'),
      localize('lineNumbers.on', 'Line numbers are rendered as absolute number.'),
      localize('lineNumbers.relative', 'Line numbers are rendered as distance in lines to cursor position.'),
      localize('lineNumbers.interval', 'Line numbers are rendered every 10 lines.'),
    ],
    'default': 'on',
    'description': localize('lineNumbers', 'Controls the display of line numbers.'),
  },
  'editor.renderFinalNewline': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.renderFinalNewline,
    'description': localize('renderFinalNewline', 'Render last line number when the file ends with a newline.'),
  },
  'editor.rulers': {
    'type': 'array',
    'items': {
      'type': 'number',
    },
    'default': EDITOR_DEFAULTS.viewInfo.rulers,
    'description': localize('rulers', 'Render vertical rulers after a certain number of monospace characters. Use multiple values for multiple rulers. No rulers are drawn if array is empty.'),
  },
  'editor.wordSeparators': {
    'type': 'string',
    'default': EDITOR_DEFAULTS.wordSeparators,
    'description': localize('wordSeparators', 'Characters that will be used as word separators when doing word related navigations or operations.'),
  },
  'editor.tabSize': {
    'type': 'number',
    'default': EDITOR_MODEL_DEFAULTS.tabSize,
    'minimum': 1,
    'markdownDescription': localize('tabSize', 'The number of spaces a tab is equal to. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.'),
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
    'type': 'boolean',
    'default': EDITOR_MODEL_DEFAULTS.insertSpaces,
    'markdownDescription': localize('insertSpaces', 'Insert spaces when pressing `Tab`. This setting is overridden based on the file contents when `#editor.detectIndentation#` is on.'),
  },
  'editor.detectIndentation': {
    'type': 'boolean',
    'default': EDITOR_MODEL_DEFAULTS.detectIndentation,
    'markdownDescription': localize('detectIndentation', 'Controls whether `#editor.tabSize#` and `#editor.insertSpaces#` will be automatically detected when a file is opened based on the file contents.'),
  },
  'editor.roundedSelection': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.roundedSelection,
    'description': localize('roundedSelection', 'Controls whether selections should have rounded corners.'),
  },
  'editor.scrollBeyondLastLine': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.scrollBeyondLastLine,
    'description': localize('scrollBeyondLastLine', 'Controls whether the editor will scroll beyond the last line.'),
  },
  'editor.scrollBeyondLastColumn': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.viewInfo.scrollBeyondLastColumn,
    'description': localize('scrollBeyondLastColumn', 'Controls the number of extra characters beyond which the editor will scroll horizontally.'),
  },
  'editor.smoothScrolling': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.smoothScrolling,
    'description': localize('smoothScrolling', 'Controls whether the editor will scroll using an animation.'),
  },
  'editor.minimap.enabled': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.minimap.enabled,
    'description': localize('minimap.enabled', 'Controls whether the minimap is shown.'),
  },
  'editor.minimap.side': {
    'type': 'string',
    'enum': ['left', 'right'],
    'default': EDITOR_DEFAULTS.viewInfo.minimap.side,
    'description': localize('minimap.side', 'Controls the side where to render the minimap.'),
  },
  'editor.minimap.showSlider': {
    'type': 'string',
    'enum': ['always', 'mouseover'],
    'default': EDITOR_DEFAULTS.viewInfo.minimap.showSlider,
    'description': localize('minimap.showSlider', 'Controls whether the minimap slider is automatically hidden.'),
  },
  'editor.minimap.renderCharacters': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.minimap.renderCharacters,
    'description': localize('minimap.renderCharacters', 'Render the actual characters on a line as opposed to color blocks.'),
  },
  'editor.minimap.maxColumn': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.viewInfo.minimap.maxColumn,
    'description': localize('minimap.maxColumn', 'Limit the width of the minimap to render at most a certain number of columns.'),
  },
  'editor.hover.enabled': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.hover.enabled,
    'description': localize('hover.enabled', 'Controls whether the hover is shown.'),
  },
  'editor.hover.delay': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.contribInfo.hover.delay,
    'description': localize('hover.delay', 'Controls the delay in milliseconds after which the hover is shown.'),
  },
  'editor.hover.sticky': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.hover.sticky,
    'description': localize('hover.sticky', 'Controls whether the hover should remain visible when mouse is moved over it.'),
  },
  'editor.find.seedSearchStringFromSelection': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.find.seedSearchStringFromSelection,
    'description': localize('find.seedSearchStringFromSelection', 'Controls whether the search string in the Find Widget is seeded from the editor selection.'),
  },
  'editor.find.autoFindInSelection': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.find.autoFindInSelection,
    'description': localize('find.autoFindInSelection', 'Controls whether the find operation is carried out on selected text or the entire file in the editor.'),
  },
  'editor.find.globalFindClipboard': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.find.globalFindClipboard,
    'description': localize('find.globalFindClipboard', 'Controls whether the Find Widget should read or modify the shared find clipboard on macOS.'),
    'included': isOSX,
  },
  'editor.find.addExtraSpaceOnTop': {
    'type': 'boolean',
    'default': true,
    'description': localize('find.addExtraSpaceOnTop', 'Controls whether the Find Widget should add extra lines on top of the editor. When true, you can scroll beyond the first line when the Find Widget is visible.'),
  },
  'editor.wordWrap': {
    'type': 'string',
    'enum': ['off', 'on', 'wordWrapColumn', 'bounded'],
    'markdownEnumDescriptions': [
      localize('wordWrap.off', 'Lines will never wrap.'),
      localize('wordWrap.on', 'Lines will wrap at the viewport width.'),
      localize('wordWrap.wordWrapColumn', 'Lines will wrap at `#editor.wordWrapColumn#`.'),
      localize('wordWrap.bounded', 'Lines will wrap at the minimum of viewport and `#editor.wordWrapColumn#`.'),
    ],
    'default': EDITOR_DEFAULTS.wordWrap,
    'description': localize('wordWrap', 'Controls how lines should wrap.'),
  },
  'editor.wordWrapColumn': {
    'type': 'integer',
    'default': EDITOR_DEFAULTS.wordWrapColumn,
    'minimum': 1,
    'markdownDescription': localize('wordWrapColumn', 'Controls the wrapping column of the editor when `#editor.wordWrap#` is `wordWrapColumn` or `bounded`.'),
  },
  'editor.wrappingIndent': {
    'type': 'string',
    'enum': ['none', 'same', 'indent', 'deepIndent'],
    enumDescriptions: [
      localize('wrappingIndent.none', 'No indentation. Wrapped lines begin at column 1.'),
      localize('wrappingIndent.same', 'Wrapped lines get the same indentation as the parent.'),
      localize('wrappingIndent.indent', 'Wrapped lines get +1 indentation toward the parent.'),
      localize('wrappingIndent.deepIndent', 'Wrapped lines get +2 indentation toward the parent.'),
    ],
    'default': 'same',
    'description': localize('wrappingIndent', 'Controls the indentation of wrapped lines.'),
  },
  'editor.mouseWheelScrollSensitivity': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.viewInfo.scrollbar.mouseWheelScrollSensitivity,
    'markdownDescription': localize('mouseWheelScrollSensitivity', 'A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.'),
  },
  'editor.fastScrollSensitivity': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.viewInfo.scrollbar.fastScrollSensitivity,
    'markdownDescription': localize('fastScrollSensitivity', 'Scrolling speed multiplier when pressing `Alt`.'),
  },
  'editor.multiCursorModifier': {
    'type': 'string',
    'enum': ['ctrlCmd', 'alt'],
    'markdownEnumDescriptions': [
      localize('multiCursorModifier.ctrlCmd', 'Maps to `Control` on Windows and Linux and to `Command` on macOS.'),
      localize('multiCursorModifier.alt', 'Maps to `Alt` on Windows and Linux and to `Option` on macOS.'),
    ],
    'default': 'alt',
    'markdownDescription': localize('multiCursorModifier', 'The modifier to be used to add multiple cursors with the mouse. The Go To Definition and Open Link mouse gestures will adapt such that they do not conflict with the multicursor modifier. [Read more](https://code.visualstudio.com/docs/editor/codebasics#_multicursor-modifier).'),
  },
  'editor.multiCursorMergeOverlapping': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.multiCursorMergeOverlapping,
    'description': localize('multiCursorMergeOverlapping', 'Merge multiple cursors when they are overlapping.'),
  },
  'editor.quickSuggestions': {
    'anyOf': [
      {
        type: 'boolean',
      },
      {
        type: 'object',
        properties: {
          strings: {
            type: 'boolean',
            default: false,
            description: localize('quickSuggestions.strings', 'Enable quick suggestions inside strings.'),
          },
          comments: {
            type: 'boolean',
            default: false,
            description: localize('quickSuggestions.comments', 'Enable quick suggestions inside comments.'),
          },
          other: {
            type: 'boolean',
            default: true,
            description: localize('quickSuggestions.other', 'Enable quick suggestions outside of strings and comments.'),
          },
        },
      },
    ],
    'default': EDITOR_DEFAULTS.contribInfo.quickSuggestions,
    'description': localize('quickSuggestions', 'Controls whether suggestions should automatically show up while typing.'),
  },
  'editor.quickSuggestionsDelay': {
    'type': 'integer',
    'default': EDITOR_DEFAULTS.contribInfo.quickSuggestionsDelay,
    'minimum': 0,
    'description': localize('quickSuggestionsDelay', 'Controls the delay in milliseconds after which quick suggestions will show up.'),
  },
  'editor.parameterHints.enabled': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.parameterHints.enabled,
    'description': localize('parameterHints.enabled', 'Enables a pop-up that shows parameter documentation and type information as you type.'),
  },
  'editor.parameterHints.cycle': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.parameterHints.cycle,
    'description': localize('parameterHints.cycle', 'Controls whether the parameter hints menu cycles or closes when reaching the end of the list.'),
  },
  'editor.autoClosingBrackets': {
    type: 'string',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
    enumDescriptions: [
      '',
      localize('editor.autoClosingBrackets.languageDefined', 'Use language configurations to determine when to autoclose brackets.'),
      localize('editor.autoClosingBrackets.beforeWhitespace', 'Autoclose brackets only when the cursor is to the left of whitespace.'),
      '',

    ],
    'default': EDITOR_DEFAULTS.autoClosingBrackets,
    'description': localize('autoClosingBrackets', 'Controls whether the editor should automatically close brackets after the user adds an opening bracket.'),
  },
  'editor.autoClosingQuotes': {
    type: 'string',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
    enumDescriptions: [
      '',
      localize('editor.autoClosingQuotes.languageDefined', 'Use language configurations to determine when to autoclose quotes.'),
      localize('editor.autoClosingQuotes.beforeWhitespace', 'Autoclose quotes only when the cursor is to the left of whitespace.'),
      '',
    ],
    'default': EDITOR_DEFAULTS.autoClosingQuotes,
    'description': localize('autoClosingQuotes', 'Controls whether the editor should automatically close quotes after the user adds an opening quote.'),
  },
  'editor.autoSurround': {
    type: 'string',
    enum: ['languageDefined', 'brackets', 'quotes', 'never'],
    enumDescriptions: [
      localize('editor.autoSurround.languageDefined', 'Use language configurations to determine when to automatically surround selections.'),
      localize('editor.autoSurround.brackets', 'Surround with brackets but not quotes.'),
      localize('editor.autoSurround.quotes', 'Surround with quotes but not brackets.'),
      '',
    ],
    'default': EDITOR_DEFAULTS.autoSurround,
    'description': localize('autoSurround', 'Controls whether the editor should automatically surround selections.'),
  },
  'editor.formatOnType': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.formatOnType,
    'description': localize('formatOnType', 'Controls whether the editor should automatically format the line after typing.'),
  },
  'editor.formatOnPaste': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.formatOnPaste,
    'description': localize('formatOnPaste', 'Controls whether the editor should automatically format the pasted content. A formatter must be available and the formatter should be able to format a range in a document.'),
  },
  'editor.autoIndent': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.autoIndent,
    'description': localize('autoIndent', 'Controls whether the editor should automatically adjust the indentation when users type, paste or move lines. Extensions with indentation rules of the language must be available.'),
  },
  'editor.suggestOnTriggerCharacters': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.suggestOnTriggerCharacters,
    'description': localize('suggestOnTriggerCharacters', 'Controls whether suggestions should automatically show up when typing trigger characters.'),
  },
  'editor.acceptSuggestionOnEnter': {
    'type': 'string',
    'enum': ['on', 'smart', 'off'],
    'default': EDITOR_DEFAULTS.contribInfo.acceptSuggestionOnEnter,
    'markdownEnumDescriptions': [
      '',
      localize('acceptSuggestionOnEnterSmart', 'Only accept a suggestion with `Enter` when it makes a textual change.'),
      '',
    ],
    'markdownDescription': localize('acceptSuggestionOnEnter', 'Controls whether suggestions should be accepted on `Enter`, in addition to `Tab`. Helps to avoid ambiguity between inserting new lines or accepting suggestions.'),
  },
  'editor.acceptSuggestionOnCommitCharacter': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.acceptSuggestionOnCommitCharacter,
    'markdownDescription': localize('acceptSuggestionOnCommitCharacter', 'Controls whether suggestions should be accepted on commit characters. For example, in JavaScript, the semi-colon (`;`) can be a commit character that accepts a suggestion and types that character.'),
  },
  'editor.snippetSuggestions': {
    'type': 'string',
    'enum': ['top', 'bottom', 'inline', 'none'],
    'enumDescriptions': [
      localize('snippetSuggestions.top', 'Show snippet suggestions on top of other suggestions.'),
      localize('snippetSuggestions.bottom', 'Show snippet suggestions below other suggestions.'),
      localize('snippetSuggestions.inline', 'Show snippets suggestions with other suggestions.'),
      localize('snippetSuggestions.none', 'Do not show snippet suggestions.'),
    ],
    'default': EDITOR_DEFAULTS.contribInfo.suggest.snippets,
    'description': localize('snippetSuggestions', 'Controls whether snippets are shown with other suggestions and how they are sorted.'),
  },
  'editor.emptySelectionClipboard': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.emptySelectionClipboard,
    'description': localize('emptySelectionClipboard', 'Controls whether copying without a selection copies the current line.'),
  },
  'editor.copyWithSyntaxHighlighting': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.copyWithSyntaxHighlighting,
    'description': localize('copyWithSyntaxHighlighting', 'Controls whether syntax highlighting should be copied into the clipboard.'),
  },
  'editor.wordBasedSuggestions': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.wordBasedSuggestions,
    'description': localize('wordBasedSuggestions', 'Controls whether completions should be computed based on words in the document.'),
  },
  'editor.suggestSelection': {
    'type': 'string',
    'enum': ['first', 'recentlyUsed', 'recentlyUsedByPrefix'],
    'markdownEnumDescriptions': [
      localize('suggestSelection.first', 'Always select the first suggestion.'),
      localize('suggestSelection.recentlyUsed', 'Select recent suggestions unless further typing selects one, e.g. `console.| -> console.log` because `log` has been completed recently.'),
      localize('suggestSelection.recentlyUsedByPrefix', 'Select suggestions based on previous prefixes that have completed those suggestions, e.g. `co -> console` and `con -> const`.'),
    ],
    'default': 'recentlyUsed',
    'description': localize('suggestSelection', 'Controls how suggestions are pre-selected when showing the suggest list.'),
  },
  'editor.suggestFontSize': {
    'type': 'integer',
    'default': 0,
    'minimum': 0,
    'markdownDescription': localize('suggestFontSize', 'Font size for the suggest widget. When set to `0`, the value of `#editor.fontSize#` is used.'),
  },
  'editor.suggestLineHeight': {
    'type': 'integer',
    'default': 0,
    'minimum': 0,
    'markdownDescription': localize('suggestLineHeight', 'Line height for the suggest widget. When set to `0`, the value of `#editor.lineHeight#` is used.'),
  },
  'editor.tabCompletion': {
    type: 'string',
    default: 'off',
    enum: ['on', 'off', 'onlySnippets'],
    enumDescriptions: [
      localize('tabCompletion.on', 'Tab complete will insert the best matching suggestion when pressing tab.'),
      localize('tabCompletion.off', 'Disable tab completions.'),
      localize('tabCompletion.onlySnippets', "Tab complete snippets when their prefix match. Works best when 'quickSuggestions' aren't enabled."),
    ],
    description: localize('tabCompletion', 'Enables tab completions.'),
  },
  'editor.suggest.filterGraceful': {
    type: 'boolean',
    default: true,
    description: localize('suggest.filterGraceful', 'Controls whether filtering and sorting suggestions accounts for small typos.'),
  },
  'editor.suggest.localityBonus': {
    type: 'boolean',
    default: false,
    description: localize('suggest.localityBonus', 'Controls whether sorting favours words that appear close to the cursor.'),
  },
  'editor.suggest.shareSuggestSelections': {
    type: 'boolean',
    default: false,
    markdownDescription: localize('suggest.shareSuggestSelections', 'Controls whether remembered suggestion selections are shared between multiple workspaces and windows (needs `#editor.suggestSelection#`).'),
  },
  'editor.suggest.snippetsPreventQuickSuggestions': {
    type: 'boolean',
    default: true,
    description: localize('suggest.snippetsPreventQuickSuggestions', 'Control whether an active snippet prevents quick suggestions.'),
  },
  'editor.suggest.showIcons': {
    type: 'boolean',
    default: EDITOR_DEFAULTS.contribInfo.suggest.showIcons,
    description: localize('suggest.showIcons', 'Controls whether to show or hide icons in suggestions.'),
  },
  'editor.suggest.maxVisibleSuggestions': {
    type: 'number',
    default: EDITOR_DEFAULTS.contribInfo.suggest.maxVisibleSuggestions,
    minimum: 1,
    maximum: 15,
    description: localize('suggest.maxVisibleSuggestions', 'Controls how many suggestions IntelliSense will show before showing a scrollbar (maximum 15).'),
  },
  'editor.suggest.filteredTypes': {
    type: 'object',
    default: { keyword: true, snippet: true },
    markdownDescription: localize('suggest.filtered', 'Controls whether some suggestion types should be filtered from IntelliSense. A list of suggestion types can be found here: https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions.'),
    properties: {
      method: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.method', 'When set to `false` IntelliSense never shows `method` suggestions.'),
      },
      function: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.function', 'When set to `false` IntelliSense never shows `function` suggestions.'),
      },
      constructor: {
        type: 'boolean' as 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.constructor', 'When set to `false` IntelliSense never shows `constructor` suggestions.'),
      },
      field: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.field', 'When set to `false` IntelliSense never shows `field` suggestions.'),
      },
      variable: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.variable', 'When set to `false` IntelliSense never shows `variable` suggestions.'),
      },
      class: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.class', 'When set to `false` IntelliSense never shows `class` suggestions.'),
      },
      struct: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.struct', 'When set to `false` IntelliSense never shows `struct` suggestions.'),
      },
      interface: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.interface', 'When set to `false` IntelliSense never shows `interface` suggestions.'),
      },
      module: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.module', 'When set to `false` IntelliSense never shows `module` suggestions.'),
      },
      property: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.property', 'When set to `false` IntelliSense never shows `property` suggestions.'),
      },
      event: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.event', 'When set to `false` IntelliSense never shows `event` suggestions.'),
      },
      operator: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.operator', 'When set to `false` IntelliSense never shows `operator` suggestions.'),
      },
      unit: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.unit', 'When set to `false` IntelliSense never shows `unit` suggestions.'),
      },
      value: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.value', 'When set to `false` IntelliSense never shows `value` suggestions.'),
      },
      constant: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.constant', 'When set to `false` IntelliSense never shows `constant` suggestions.'),
      },
      enum: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.enum', 'When set to `false` IntelliSense never shows `enum` suggestions.'),
      },
      enumMember: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.enumMember', 'When set to `false` IntelliSense never shows `enumMember` suggestions.'),
      },
      keyword: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.keyword', 'When set to `false` IntelliSense never shows `keyword` suggestions.'),
      },
      text: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.text', 'When set to `false` IntelliSense never shows `text` suggestions.'),
      },
      color: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.color', 'When set to `false` IntelliSense never shows `color` suggestions.'),
      },
      file: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.file', 'When set to `false` IntelliSense never shows `file` suggestions.'),
      },
      reference: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.reference', 'When set to `false` IntelliSense never shows `reference` suggestions.'),
      },
      customcolor: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.customcolor', 'When set to `false` IntelliSense never shows `customcolor` suggestions.'),
      },
      folder: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.folder', 'When set to `false` IntelliSense never shows `folder` suggestions.'),
      },
      typeParameter: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.typeParameter', 'When set to `false` IntelliSense never shows `typeParameter` suggestions.'),
      },
      snippet: {
        type: 'boolean',
        default: true,
        markdownDescription: localize('suggest.filtered.snippet', 'When set to `false` IntelliSense never shows `snippet` suggestions.'),
      },
    },
  },
  'editor.gotoLocation.multiple': {
    description: localize('editor.gotoLocation.multiple', "Controls the behavior of 'Go To' commands, like Go To Definition, when multiple target locations exist."),
    type: 'string',
    enum: ['peek', 'gotoAndPeek', 'goto'],
    default: EDITOR_DEFAULTS.contribInfo.gotoLocation.multiple,
    enumDescriptions: [
      localize('editor.gotoLocation.multiple.peek', 'Show peek view of the results (default)'),
      localize('editor.gotoLocation.multiple.gotoAndPeek', 'Go to the primary result and show a peek view'),
      localize('editor.gotoLocation.multiple.goto', 'Go to the primary result and enable peek-less navigation to others'),
    ],
  },
  'editor.selectionHighlight': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.selectionHighlight,
    'description': localize('selectionHighlight', 'Controls whether the editor should highlight matches similar to the selection.'),
  },
  'editor.occurrencesHighlight': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.occurrencesHighlight,
    'description': localize('occurrencesHighlight', 'Controls whether the editor should highlight semantic symbol occurrences.'),
  },
  'editor.overviewRulerLanes': {
    'type': 'integer',
    'default': 3,
    'description': localize('overviewRulerLanes', 'Controls the number of decorations that can show up at the same position in the overview ruler.'),
  },
  'editor.overviewRulerBorder': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.overviewRulerBorder,
    'description': localize('overviewRulerBorder', 'Controls whether a border should be drawn around the overview ruler.'),
  },
  'editor.cursorBlinking': {
    'type': 'string',
    'enum': ['blink', 'smooth', 'phase', 'expand', 'solid'],
    'default': 'blink',
    'description': localize('cursorBlinking', 'Control the cursor animation style.'),
  },
  'editor.mouseWheelZoom': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.mouseWheelZoom,
    'markdownDescription': localize('mouseWheelZoom', 'Zoom the font of the editor when using mouse wheel and holding `Ctrl`.'),
  },
  'editor.cursorSmoothCaretAnimation': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.cursorSmoothCaretAnimation,
    'description': localize('cursorSmoothCaretAnimation', 'Controls whether the smooth caret animation should be enabled.'),
  },
  'editor.cursorStyle': {
    'type': 'string',
    'enum': ['block', 'block-outline', 'line', 'line-thin', 'underline', 'underline-thin'],
    'default': EDITOR_FONT_DEFAULTS.cursorStyle,
    'description': localize('cursorStyle', 'Controls the cursor style.'),
  },
  'editor.cursorWidth': {
    'type': 'integer',
    'default': EDITOR_DEFAULTS.viewInfo.cursorWidth,
    'markdownDescription': localize('cursorWidth', 'Controls the width of the cursor when `#editor.cursorStyle#` is set to `line`.'),
  },
  'editor.fontLigatures': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.fontLigatures,
    'description': localize('fontLigatures', 'Enables/Disables font ligatures.'),
  },
  'editor.hideCursorInOverviewRuler': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.hideCursorInOverviewRuler,
    'description': localize('hideCursorInOverviewRuler', 'Controls whether the cursor should be hidden in the overview ruler.'),
  },
  'editor.renderWhitespace': {
    'type': 'string',
    'enum': ['none', 'boundary', 'selection', 'all'],
    'enumDescriptions': [
      '',
      localize('renderWhitespace.boundary', 'Render whitespace characters except for single spaces between words.'),
      localize('renderWhitespace.selection', 'Render whitespace characters only on selected text.'),
      '',
    ],
    default: EDITOR_DEFAULTS.viewInfo.renderWhitespace,
    description: localize('renderWhitespace', 'Controls how the editor should render whitespace characters.'),
  },
  'editor.rename.enablePreview': {
    type: 'boolean',
    default: true,
    description: 'Enable/disable the ability to preview changes before renaming',
  },
  'editor.renderControlCharacters': {
    'type': 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.renderControlCharacters,
    description: localize('renderControlCharacters', 'Controls whether the editor should render control characters.'),
  },
  'editor.renderIndentGuides': {
    'type': 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.renderIndentGuides,
    description: localize('renderIndentGuides', 'Controls whether the editor should render indent guides.'),
  },
  'editor.highlightActiveIndentGuide': {
    'type': 'boolean',
    default: EDITOR_DEFAULTS.viewInfo.highlightActiveIndentGuide,
    description: localize('highlightActiveIndentGuide', 'Controls whether the editor should highlight the active indent guide.'),
  },
  'editor.renderLineHighlight': {
    'type': 'string',
    'enum': ['none', 'gutter', 'line', 'all'],
    'enumDescriptions': [
      '',
      '',
      '',
      localize('renderLineHighlight.all', 'Highlights both the gutter and the current line.'),
    ],
    default: EDITOR_DEFAULTS.viewInfo.renderLineHighlight,
    description: localize('renderLineHighlight', 'Controls how the editor should render the current line highlight.'),
  },
  'editor.codeLens': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.codeLens,
    'description': localize('codeLens', 'Controls whether the editor shows CodeLens.'),
  },
  'editor.folding': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.folding,
    'description': localize('folding', 'Controls whether the editor has code folding enabled.'),
  },
  'editor.foldingStrategy': {
    'type': 'string',
    'enum': ['auto', 'indentation'],
    'default': EDITOR_DEFAULTS.contribInfo.foldingStrategy,
    'markdownDescription': localize('foldingStrategy', 'Controls the strategy for computing folding ranges. `auto` uses a language specific folding strategy, if available. `indentation` uses the indentation based folding strategy.'),
  },
  'editor.showFoldingControls': {
    'type': 'string',
    'enum': ['always', 'mouseover'],
    'default': EDITOR_DEFAULTS.contribInfo.showFoldingControls,
    'description': localize('showFoldingControls', 'Controls whether the fold controls on the gutter are automatically hidden.'),
  },
  'editor.matchBrackets': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.matchBrackets,
    'description': localize('matchBrackets', 'Highlight matching brackets when one of them is selected.'),
  },
  'editor.glyphMargin': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.viewInfo.glyphMargin,
    'description': localize('glyphMargin', 'Controls whether the editor should render the vertical glyph margin. Glyph margin is mostly used for debugging.'),
  },
  'editor.useTabStops': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.useTabStops,
    'description': localize('useTabStops', 'Inserting and deleting whitespace follows tab stops.'),
  },
  'editor.trimAutoWhitespace': {
    'type': 'boolean',
    'default': EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
    'description': localize('trimAutoWhitespace', 'Remove trailing auto inserted whitespace.'),
  },
  'editor.stablePeek': {
    'type': 'boolean',
    'default': false,
    'markdownDescription': localize('stablePeek', 'Keep peek editors open even when double clicking their content or when hitting `Escape`.'),
  },
  'editor.dragAndDrop': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.dragAndDrop,
    'description': localize('dragAndDrop', 'Controls whether the editor should allow moving selections via drag and drop.'),
  },
  'editor.accessibilitySupport': {
    'type': 'string',
    'enum': ['auto', 'on', 'off'],
    'enumDescriptions': [
      localize('accessibilitySupport.auto', 'The editor will use platform APIs to detect when a Screen Reader is attached.'),
      localize('accessibilitySupport.on', 'The editor will be permanently optimized for usage with a Screen Reader.'),
      localize('accessibilitySupport.off', 'The editor will never be optimized for usage with a Screen Reader.'),
    ],
    'default': EDITOR_DEFAULTS.accessibilitySupport,
    'description': localize('accessibilitySupport', 'Controls whether the editor should run in a mode where it is optimized for screen readers.'),
  },
  'editor.showUnused': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.showUnused,
    'description': localize('showUnused', 'Controls fading out of unused code.'),
  },
  'editor.links': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.links,
    'description': localize('links', 'Controls whether the editor should detect links and make them clickable.'),
  },
  'editor.colorDecorators': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.colorDecorators,
    'description': localize('colorDecorators', 'Controls whether the editor should render the inline color decorators and color picker.'),
  },
  'editor.lightbulb.enabled': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.lightbulbEnabled,
    'description': localize('codeActions', 'Enables the code action lightbulb in the editor.'),
  },
  'editor.maxTokenizationLineLength': {
    'type': 'integer',
    'default': 20_000,
    'description': localize('maxTokenizationLineLength', 'Lines above this length will not be tokenized for performance reasons'),
  },
  'editor.codeActionsOnSave': {
    'type': 'object',
    'properties': {
      'source.organizeImports': {
        'type': 'boolean',
        'description': localize('codeActionsOnSave.organizeImports', 'Controls whether organize imports action should be run on file save.'),
      },
      'source.fixAll': {
        'type': 'boolean',
        'description': localize('codeActionsOnSave.fixAll', 'Controls whether auto fix action should be run on file save.'),
      },
    },
    'additionalProperties': {
      'type': 'boolean',
    },
    'default': EDITOR_DEFAULTS.contribInfo.codeActionsOnSave,
    'description': localize('codeActionsOnSave', 'Code action kinds to be run on save.'),
  },
  'editor.codeActionsOnSaveTimeout': {
    'type': 'number',
    'default': EDITOR_DEFAULTS.contribInfo.codeActionsOnSaveTimeout,
    'description': localize('codeActionsOnSaveTimeout', 'Timeout in milliseconds after which the code actions that are run on save are cancelled.'),
  },
  'editor.selectionClipboard': {
    'type': 'boolean',
    'default': EDITOR_DEFAULTS.contribInfo.selectionClipboard,
    'description': localize('selectionClipboard', 'Controls whether the Linux primary clipboard should be supported.'),
    'included': isLinux,
  },
  'editor.largeFileOptimizations': {
    'type': 'boolean',
    'default': EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
    'description': localize('largeFileOptimizations', 'Special handling for large files to disable certain memory intensive features.'),
  },
  'diffEditor.renderIndicators': {
    'type': 'boolean',
    'default': true,
    'description': localize('renderIndicators', 'Controls whether the diff editor shows +/- indicators for added/removed changes.'),
  },
};

const customEditorSchema: PreferenceSchemaProperties = {
  'editor.tokenColorCustomizations': {
    type: 'object',
    description: '%preference.editor.tokenColorCustomizations%',
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
    enum: [
      'off',
      'afterDelay',
      'editorFocusChange',
      'windowLostFocus',
    ],
    default: 'off',
    description: '%editor.configuration.autoSave%',
  },
  'editor.autoSaveDelay': {
    type: 'number',
    default: 1000,
    description: '%editor.configuration.autoSaveDelay%',
  },
  'editor.preferredFormatter': {
    type: 'object',
    default: {},
    description: '%editor.configuration.preferredFormatter%',
  },
  'editor.previewMode': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.preview%',
  },
  'editor.minimap': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.minimap%',
  },
  'editor.forceReadOnly': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.forceReadOnly%',
  },
  // 会启用languageFeature的最大文件尺寸
  'editor.languageFeatureEnabledMaxSize': {
    type: 'number',
    default: 2 * 1024 * 1024, // 2M
    description: '%editor.configuration.languageFeatureEnabledMaxSize%',
  },
  // 会同步到extHost的最大文件尺寸, 必须大于等于 languageFeatureEnabledMaxSize
  'editor.docExtHostSyncMaxSize': {
    type: 'number',
    default: 2 * 1024 * 1024, // 2M
    description: '%editor.configuration.docExtHostSyncMaxSize%',
  },
  'editor.renderLineHighlight': {
    type: 'string',
    enum: [
      'none',
      'gutter',
      'line',
      'all',
    ],
    default: 'all',
    description: '%editor.configuration.renderLineHighlight%',
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
    description: '%editor.configuration.fontSize%',
    minimum: 6,
  },
  'editor.tabSize': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.tabSize,
    description: '%editor.configuration.tabSize%',
  },
  'editor.formatOnPaste': {
    type: 'boolean',
    default: false,
    description: '%editor.configuration.formatOnPaste%',
  },
  'editor.detectIndentation': {
    type: 'boolean',
    default: true,
    description: '%editor.configuration.detectIndentation%',
  },
  'editor.renderWhitespace': {
    type: 'boolean',
    default: EDITOR_FONT_DEFAULTS.renderWhitespace,
    description: '%editor.configuration.renderWhitespace%',
  },
  'editor.cursorStyle': {
    type: 'string',
    enum: [
      'line',
      'block',
      'block-outline',
      'line-thin',
      'underline',
      'underline-thin',
    ],
    default: EDITOR_FONT_DEFAULTS.cursorStyle,
    description: '%editor.configuration.cursorStyle%',
  },
  'editor.insertSpaces': {
    type: 'boolean',
    default: EDITOR_FONT_DEFAULTS.insertSpace,
    description: '%editor.configuration.insertSpace%',
  },
  'editor.wordWrap': {
    type: 'string',
    enum: [
      'off',
      'on',
    ],
    default: EDITOR_FONT_DEFAULTS.wordWrap,
    description: '%editor.configuration.wordWrap%',
  },
  'editor.wordWrapColumn': {
    type: 'number',
    default: EDITOR_FONT_DEFAULTS.wordWrapColumn,
    description: '%editor.configuration.wordWrapColumn%',
  },
  'editor.readonlyFiles': {
    type: 'array',
    default: [],
    description: '%editor.configuration.readonlyFiles%',
    items: {
      type: 'string',
    },
  },
  'editor.formatOnSave': {
    type: 'boolean',
    default: false,
    description: '%preference.editor.formatOnSave%',
  },
  'editor.formatOnSaveTimeout': {
    type: 'number',
    default: 750,
    description: '%editor.configuration.readonlyFiles%',
  },
  'editor.maxTokenizationLineLength': {
    type: 'integer',
    default: 10000,
    description: '%editor.configuration.maxTokenizationLineLength%',
  },
  'editor.largeFile': {
    type: 'number',
    default: 2 * 1024 * 1024,
    description: '%editor.configuration.largeFileSize%',
  },
  'editor.quickSuggestionsDelay': {
    type: 'integer',
    default: 100,
    // description: '%editor.configuration.quickSuggestionsDelay%',
  },
  'editor.quickSuggestionsMaxCount': {
    type: 'integer',
    default: 0,
  },
  'editor.modelDisposeTime': {
    type: 'integer',
    default: 3000,
  },
  'diffEditor.renderSideBySide': {
    'type': 'boolean',
    'default': true,
    'description': '%diffEditor.configuration.renderSideBySide%',
  },
  'diffEditor.ignoreTrimWhitespace': {
    'type': 'boolean',
    'default': false, // 开天修改
    'description': '%diffEditor.configuration.ignoreTrimWhitespace%',
  },
};

export const editorPreferenceSchema: PreferenceSchema = {
  'type': 'object',
  properties: {
    ...monacoEditorSchema,
    ...customEditorSchema,
  },
};

export const EditorPreferences = Symbol('EditorPreference');
export type EditorPreferences = PreferenceProxy<{
  'editor.readonlyFiles': string[],
  'editor.previewMode': boolean,
  'editor.autoSaveDelay': number;
  'editor.autoSave': string;
}>;
