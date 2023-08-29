import { objects, Uri } from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { IConvertedMonacoOptions } from '../types';

const { removeUndefined } = objects;

/**
 * 计算由ConfigurationService设置值带来的monaco编辑器的属性
 * @param configurationService IConfigurationService
 * @param updatingKey 需要处理的Preference key。如果没有这个值，默认处理全部。
 */
export function getConvertedMonacoOptions(
  configurationService: IConfigurationService,
  resourceUri?: string,
  language?: string,
  updatingKey?: string[],
): IConvertedMonacoOptions {
  const editorOptions: Partial<monaco.editor.IEditorOptions> = {};
  const diffOptions: Partial<monaco.editor.IDiffEditorOptions> = {};
  const modelOptions: Partial<monaco.editor.ITextModelUpdateOptions> = {};
  const editorOptionsKeys = updatingKey
    ? updatingKey.filter((key) => editorOptionsConverters.has(key))
    : Array.from(editorOptionsConverters.keys());
  const textModelUpdateOptionsKeys = updatingKey
    ? updatingKey.filter((key) => textModelUpdateOptionsConverters.has(key))
    : Array.from(textModelUpdateOptionsConverters.keys());
  const diffEditorOptionsKeys = updatingKey
    ? updatingKey.filter((key) => diffEditorOptionsConverters.has(key))
    : Array.from(diffEditorOptionsConverters.keys());

  editorOptionsKeys.forEach((key) => {
    const value = configurationService.getValue(key, {
      resource: resourceUri ? Uri.parse(resourceUri) : undefined,
      overrideIdentifier: language,
    });
    if (value === undefined) {
      return;
    }
    if (!editorOptionsConverters.get(key)) {
      editorOptions[key] = value;
    } else {
      const converter: IMonacoOptionsConverter = editorOptionsConverters.get(key)! as IMonacoOptionsConverter;
      editorOptions[converter.monaco] = converter.convert ? converter.convert(value) : value;
    }
  });

  textModelUpdateOptionsKeys.forEach((key) => {
    const value = configurationService.getValue(key, {
      resource: resourceUri ? Uri.parse(resourceUri) : undefined,
      overrideIdentifier: language,
    });
    if (value === undefined) {
      return;
    }
    if (!textModelUpdateOptionsConverters.get(key)) {
      modelOptions[key] = value;
    } else {
      const converter: IMonacoOptionsConverter = textModelUpdateOptionsConverters.get(key)! as IMonacoOptionsConverter;
      modelOptions[converter.monaco] = converter.convert ? converter.convert(value) : value;
    }
  });

  diffEditorOptionsKeys.forEach((key) => {
    const value = configurationService.getValue(key, {
      resource: resourceUri ? Uri.parse(resourceUri) : undefined,
      overrideIdentifier: language,
    });
    if (value === undefined) {
      return;
    }
    if (!diffEditorOptionsConverters.get(key)) {
      editorOptions[key] = value;
    } else {
      const converter: IMonacoOptionsConverter = diffEditorOptionsConverters.get(key)! as IMonacoOptionsConverter;
      diffOptions[converter.monaco] = converter.convert ? converter.convert(value) : value;
    }
  });

  return {
    editorOptions: removeUndefined(editorOptions),
    modelOptions: removeUndefined(modelOptions),
    diffOptions: removeUndefined(diffOptions),
  };
}

type NoConverter = false;
type KaitianPreferenceKey = string;
type MonacoPreferenceKey = string;
/**
 * monacoOption和Preference的转换
 */
interface IMonacoOptionsConverter {
  /**
   * monaco编辑器的设置值
   */
  monaco: MonacoPreferenceKey;
  /**
   * 转换器：输入为Preference值，输出monaco Options值
   */
  convert?: (value: any) => any;
}
/**
 * Configuration options for the editor.
 */
export const editorOptionsConverters: Map<KaitianPreferenceKey, NoConverter | IMonacoOptionsConverter> = new Map<
  string,
  NoConverter | IMonacoOptionsConverter
>([
  /**
   * The aria label for the editor's textarea (when it is focused).
   */
  ['editor.ariaLabel', { monaco: 'ariaLabel' }],

  /**
   * Render vertical lines at the specified columns.
   * Defaults to empty array.
   */
  ['editor.rulers', { monaco: 'rulers' }],

  /**
     * A string containing the word separators used when doing word navigation.
     * Defaults to `~!@#$%^&*()-=+[{]}\\|;'',

     */
  ['editor.wordSeparators', { monaco: 'wordSeparators' }],

  /**
   * Enable Linux primary clipboard.
   * Defaults to true.
   */
  ['editor.selectionClipboard', { monaco: 'selectionClipboard' }],

  /**
   * Control the rendering of line numbers.
   * If it is a function, it will be invoked when rendering a line number and the return value will be rendered.
   * Otherwise, if it is a truey, line numbers will be rendered normally (equivalent of using an identity function).
   * Otherwise, line numbers will not be rendered.
   * Defaults to true.
   */
  ['editor.lineNumbers', { monaco: 'lineNumbers' }],

  /**
   * Render last line number when the file ends with a newline.
   * Defaults to true.
   */
  ['editor.renderFinalNewline', { monaco: 'renderFinalNewline' }],

  /**
   * Should the corresponding line be selected when clicking on the line number?
   * Defaults to true.
   */
  ['editor.selectOnLineNumbers', { monaco: 'selectOnLineNumbers' }],

  /**
   * Control the width of line numbers, by reserving horizontal space for rendering at least an amount of digits.
   * Defaults to 5.
   */
  ['editor.lineNumbersMinChars', { monaco: 'lineNumbersMinChars' }],

  /**
   * Enable the rendering of the glyph margin.
   * Defaults to true in vscode and to false in monaco-editor.
   */
  ['editor.glyphMargin', { monaco: 'glyphMargin' }],

  /**
   * The width reserved for line decorations (in px).
   * Line decorations are placed between line numbers and the editor content.
   * You can pass in a string in the format floating point followed by "ch". e.g. 1.3ch.
   * Defaults to 10.
   */
  ['editor.lineDecorationsWidth', { monaco: 'lineDecorationsWidth' }],

  /**
   * When revealing the cursor, a virtual padding (px) is added to the cursor, turning it into a rectangle.
   * This virtual padding ensures that the cursor gets revealed before hitting the edge of the viewport.
   * Defaults to 30 (px).
   */
  ['editor.revealHorizontalRightPadding', { monaco: 'revealHorizontalRightPadding' }],

  /**
   * Render the editor selection with rounded borders.
   * Defaults to true.
   */
  ['editor.roundedSelection', { monaco: 'roundedSelection' }],

  /**
   * Class name to be added to the editor.
   */
  ['editor.extraEditorClassName', { monaco: 'extraEditorClassName' }],

  /**
   * Should the editor be read only.
   * Defaults to false.
   */
  ['editor.readOnly', { monaco: 'readOnly' }],

  /**
   * Control the behavior and rendering of the scrollbars.
   */
  ['editor.scrollbar', { monaco: 'scrollbar' }],

  /**
   * Control the behavior and rendering of the minimap.
   */
  [
    'editor.minimap',
    {
      monaco: 'minimap',
      convert: (value: any) => ({
        enabled: value,
      }),
    },
  ],

  /**
   * Control the behavior of the find widget.
   */
  ['editor.find', { monaco: 'find' }],

  /**
   * Display overflow widgets as `fixed`.
   * Defaults to `false`.
   */
  ['editor.fixedOverflowWidgets', { monaco: 'fixedOverflowWidgets' }],

  /**
   * The number of vertical lanes the overview ruler should render.
   * Defaults to 2.
   */
  ['editor.overviewRulerLanes', { monaco: 'overviewRulerLanes' }],

  /**
   * Controls if a border should be drawn around the overview ruler.
   * Defaults to `true`.
   */
  ['editor.overviewRulerBorder', { monaco: 'overviewRulerBorder' }],

  /**
   * Control the cursor animation style, possible values are 'blink', 'smooth', 'phase', 'expand' and 'solid'.
   * Defaults to 'blink'.
   */
  ['editor.cursorBlinking', { monaco: 'cursorBlinking' }],

  /**
   * Zoom the font in the editor when using the mouse wheel in combination with holding Ctrl.
   * Defaults to false.
   */
  ['editor.mouseWheelZoom', { monaco: 'mouseWheelZoom' }],

  /**
   * Enable smooth caret animation.
   * Defaults to false.
   */
  ['editor.cursorSmoothCaretAnimation', { monaco: 'cursorSmoothCaretAnimation' }],

  /**
   * Control the cursor style, either 'block' or 'line'.
   * Defaults to 'line'.
   */
  ['editor.cursorStyle', { monaco: 'cursorStyle' }],

  /**
   * Control the width of the cursor when cursorStyle is set to 'line'
   */
  ['editor.cursorWidth', { monaco: 'cursorWidth' }],

  /**
   * Enable font ligatures.
   * Defaults to false.
   */
  ['editor.fontLigatures', { monaco: 'fontLigatures' }],

  /**
   * Disable the use of `will-change` for the editor margin and lines layers.
   * The usage of `will-change` acts as a hint for browsers to create an extra layer.
   * Defaults to false.
   */
  ['editor.disableLayerHinting', { monaco: 'disableLayerHinting' }],

  /**
   * Disable the optimizations for monospace fonts.
   * Defaults to false.
   */
  ['editor.disableMonospaceOptimizations', { monaco: 'disableMonospaceOptimizations' }],

  /**
   * Should the cursor be hidden in the overview ruler.
   * Defaults to false.
   */
  ['editor.hideCursorInOverviewRuler', { monaco: 'hideCursorInOverviewRuler' }],

  /**
   * Enable that scrolling can go one screen size after the last line.
   * Defaults to true.
   */
  ['editor.scrollBeyondLastLine', { monaco: 'scrollBeyondLastLine' }],

  /**
   * Enable that scrolling can go beyond the last column by a number of columns.
   * Defaults to 5.
   */
  ['editor.scrollBeyondLastColumn', { monaco: 'scrollBeyondLastColumn' }],

  /**
   * Enable that the editor animates scrolling to a position.
   * Defaults to false.
   */
  ['editor.smoothScrolling', { monaco: 'smoothScrolling' }],

  /**
   * Enable that the editor will install an interval to check if its container dom node size has changed.
   * Enabling this might have a severe performance impact.
   * Defaults to false.
   */
  ['editor.automaticLayout', { monaco: 'automaticLayout' }],

  /**
   * Control the wrapping of the editor.
   * When `wordWrap` = "off", the lines will never wrap.
   * When `wordWrap` = "on", the lines will wrap at the viewport width.
   * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
   * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
   * Defaults to "off".
   */
  ['editor.wordWrap', { monaco: 'wordWrap' }],

  /**
   * Control the wrapping of the editor.
   * When `wordWrap` = "off", the lines will never wrap.
   * When `wordWrap` = "on", the lines will wrap at the viewport width.
   * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
   * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
   * Defaults to 80.
   */
  ['editor.wordWrapColumn', { monaco: 'wordWrapColumn' }],

  /**
   * Force word wrapping when the text appears to be of a minified/generated file.
   * Defaults to true.
   */
  ['editor.wordWrapMinified', { monaco: 'wordWrapMinified' }],

  /**
     * Control indentation of wrapped lines. Can 'be',

     * Defaults to 'same' in vscode and to 'none' in monaco-editor.
     */
  ['editor.wrappingIndent', { monaco: 'wrappingIndent' }],

  /**
   * Configure word wrapping characters. A break will be introduced before these characters.
   * Defaults to '{([+'.
   */
  ['editor.wordWrapBreakBeforeCharacters', { monaco: 'wordWrapBreakBeforeCharacters' }],

  /**
   * Configure word wrapping characters. A break will be introduced after these characters.
   * Defaults to ' \t})]?|&,;'.
   */
  ['editor.wordWrapBreakAfterCharacters', { monaco: 'wordWrapBreakAfterCharacters' }],

  /**
   * Configure word wrapping characters. A break will be introduced after these characters only if no `wordWrapBreakBeforeCharacters` or `wordWrapBreakAfterCharacters` were found.
   * Defaults to '.'.
   */
  ['editor.wordWrapBreakObtrusiveCharacters', { monaco: 'wordWrapBreakObtrusiveCharacters' }],

  /**
     * Performance 'guard',

     * Defaults to 10000.
     * Use -1 to never stop rendering
     */
  ['editor.stopRenderingLineAfter', { monaco: 'stopRenderingLineAfter' }],

  /**
   * Configure the editor's hover.
   */
  ['editor.hover', { monaco: 'hover' }],

  /**
   * Enable detecting links and making them clickable.
   * Defaults to true.
   */
  ['editor.links', { monaco: 'links' }],

  /**
   * Enable inline color decorators and color picker rendering.
   */
  ['editor.colorDecorators', { monaco: 'colorDecorators' }],

  /**
   * Enable custom contextmenu.
   * Defaults to true.
   */
  ['editor.contextmenu', { monaco: 'contextmenu' }],

  /**
   * A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.
   * Defaults to 1.
   */
  ['editor.mouseWheelScrollSensitivity', { monaco: 'mouseWheelScrollSensitivity' }],

  /**
   * FastScrolling mulitplier speed when pressing `Alt`
   * Defaults to 5.
   */
  ['editor.fastScrollSensitivity', { monaco: 'fastScrollSensitivity' }],

  /**
   * The modifier to be used to add multiple cursors with the mouse.
   * Defaults to 'alt'
   */
  ['editor.multiCursorModifier', { monaco: 'multiCursorModifier' }],

  /**
   * Merge overlapping selections.
   * Defaults to true
   */
  ['editor.multiCursorMergeOverlapping', { monaco: 'multiCursorMergeOverlapping' }],

  /**
   * Configure the editor's accessibility support.
   * Defaults to 'auto'. It is best to leave this to 'auto'.
   */
  ['editor.accessibilitySupport', { monaco: 'accessibilitySupport' }],

  /**
   * Suggest options.
   */
  ['editor.suggest', { monaco: 'suggest' }],

  /**
   *
   */
  ['editor.gotoLocation', { monaco: 'gotoLocation' }],

  /**
   * Enable quick suggestions (shadow suggestions)
   * Defaults to true.
   */
  ['editor.quickSuggestions', { monaco: 'quickSuggestions' }],
  /**
   * Quick suggestions show delay (in ms)
   * Defaults to 500 (ms)
   */
  ['editor.quickSuggestionsDelay', { monaco: 'quickSuggestionsDelay' }],

  /**
   * Parameter hint options.
   */
  ['editor.parameterHints', { monaco: 'parameterHints' }],

  /**
   * Options for auto closing brackets.
   * Defaults to language defined behavior.
   */
  ['editor.autoClosingBrackets', { monaco: 'autoClosingBrackets' }],

  /**
   * Options for auto closing quotes.
   * Defaults to language defined behavior.
   */
  ['editor.autoClosingQuotes', { monaco: 'autoClosingQuotes' }],

  /**
   * Options for auto surrounding.
   * Defaults to always allowing auto surrounding.
   */
  ['editor.autoSurround', { monaco: 'autoSurround' }],

  /**
   * Enable auto indentation adjustment.
   * Defaults to false.
   */
  ['editor.autoIndent', { monaco: 'autoIndent' }],

  /**
   * Enable format on type.
   * Defaults to false.
   */
  ['editor.formatOnType', { monaco: 'formatOnType' }],

  /**
   * Enable format on paste.
   * Defaults to false.
   */
  ['editor.formatOnPaste', { monaco: 'formatOnPaste' }],

  /**
   * Controls if the editor should allow to move selections via drag and drop.
   * Defaults to false.
   */
  ['editor.dragAndDrop', { monaco: 'dragAndDrop' }],

  /**
   * Enable the suggestion box to pop-up on trigger characters.
   * Defaults to true.
   */
  ['editor.suggestOnTriggerCharacters', { monaco: 'suggestOnTriggerCharacters' }],

  /**
   * Accept suggestions on ENTER.
   * Defaults to 'on'.
   */
  ['editor.acceptSuggestionOnEnter', { monaco: 'acceptSuggestionOnEnter' }],

  /**
   * Accept suggestions on provider defined characters.
   * Defaults to true.
   */
  ['editor.acceptSuggestionOnCommitCharacter', { monaco: 'acceptSuggestionOnCommitCharacter' }],

  /**
   * Enable snippet suggestions. Default to 'true'.
   */
  ['editor.snippetSuggestions', { monaco: 'snippetSuggestions' }],

  /**
   * Copying without a selection copies the current line.
   */
  ['editor.emptySelectionClipboard', { monaco: 'emptySelectionClipboard' }],

  /**
   * Syntax highlighting is copied.
   */
  ['editor.copyWithSyntaxHighlighting', { monaco: 'copyWithSyntaxHighlighting' }],

  /**
   * Enable word based suggestions. Defaults to 'true'
   */
  ['editor.wordBasedSuggestions', { monaco: 'wordBasedSuggestions' }],

  /**
   * The history mode for suggestions.
   */
  ['editor.suggestSelection', { monaco: 'suggestSelection' }],

  /**
   * The font size for the suggest widget.
   * Defaults to the editor font size.
   */
  ['editor.suggestFontSize', { monaco: 'suggestFontSize' }],

  /**
   * The line height for the suggest widget.
   * Defaults to the editor line height.
   */
  ['editor.suggestLineHeight', { monaco: 'suggestLineHeight' }],

  /**
   * Enable tab completion.
   */
  ['editor.tabCompletion', { monaco: 'tabCompletion' }],

  /**
   * Enable selection highlight.
   * Defaults to true.
   */
  ['editor.selectionHighlight', { monaco: 'selectionHighlight' }],

  /**
   * Enable semantic occurrences highlight.
   * Defaults to true.
   */
  ['editor.occurrencesHighlight', { monaco: 'occurrencesHighlight' }],

  /**
   * Show code lens
   * Defaults to true.
   */
  ['editor.codeLens', { monaco: 'codeLens' }],

  /**
   * Control the behavior and rendering of the code action lightbulb.
   */
  ['editor.lightbulb', { monaco: 'lightbulb' }],

  /**
   * Code action kinds to be run on save.
   */
  ['editor.codeActionsOnSave', { monaco: 'codeActionsOnSave' }],

  /**
   * Timeout for running code actions on save.
   */
  ['editor.codeActionsOnSaveTimeout', { monaco: 'codeActionsOnSaveTimeout' }],

  /**
   * Enable code folding
   * Defaults to true.
   */
  ['editor.folding', { monaco: 'folding' }],

  /**
   * Selects the folding strategy. 'auto' uses the strategies contributed for the current document, 'indentation' uses the indentation based folding strategy.
   * Defaults to 'auto'.
   */
  ['editor.foldingStrategy', { monaco: 'foldingStrategy' }],

  /**
   * Controls whether the fold actions in the gutter stay always visible or hide unless the mouse is over the gutter.
   * Defaults to 'mouseover'.
   */
  ['editor.showFoldingControls', { monaco: 'showFoldingControls' }],

  /**
   * Enable highlighting of matching brackets.
   * Defaults to true.
   */
  ['editor.matchBrackets', { monaco: 'matchBrackets' }],

  /**
   * Enable rendering of whitespace.
   * Defaults to none.
   */
  ['editor.renderWhitespace', { monaco: 'renderWhitespace' }],

  /**
   * Enable rendering of control characters.
   * Defaults to false.
   */
  ['editor.renderControlCharacters', { monaco: 'renderControlCharacters' }],

  /**
   * Enable rendering of indent guides.
   * Defaults to true.
   */
  ['editor.renderIndentGuides', { monaco: 'guides.indentation' }],

  /**
   * Enable highlighting of the active indent guide.
   * Defaults to true.
   */
  ['editor.highlightActiveIndentGuide', { monaco: 'guides.highlightActiveIndentation' }],

  /**
   * editor.guides -> guides
   */
  ['editor.guides', { monaco: 'guides' }],

  /**
   * Enable rendering of current line highlight.
   * Defaults to all.
   */
  ['editor.renderLineHighlight', { monaco: 'renderLineHighlight' }],

  /**
   * Inserting and deleting whitespace follows tab stops.
   */
  ['editor.useTabStops', { monaco: 'useTabStops' }],

  /**
   * The font family
   */
  ['editor.fontFamily', { monaco: 'fontFamily' }],

  /**
   * The font weight
   */
  ['editor.fontWeight', { monaco: 'fontWeight' }],

  /**
   * The font size
   */
  ['editor.fontSize', { monaco: 'fontSize' }],

  /**
   * The line height
   */
  ['editor.lineHeight', { monaco: 'lineHeight' }],

  /**
   * The letter spacing
   */
  ['editor.letterSpacing', { monaco: 'letterSpacing' }],

  /**
   * Controls fading out of unused variables.
   */
  ['editor.showUnused', { monaco: 'showUnused' }],

  ['editor.rename.enablePreview', { monaco: 'editor.rename.enablePreview' }],

  ['editor.semanticHighlighting', { monaco: 'semanticHighlighting' }],

  ['editor.bracketPairColorization', { monaco: 'bracketPairColorization' }],

  /**
   * Controls the algorithm that computes wrapping points.
   * Default is "advanced" (Monaco Editor default is "simple")
   */
  ['editor.wrappingStrategy', { monaco: 'wrappingStrategy' }],

  [
    'editor.experimental.stickyScroll.enabled',
    {
      monaco: 'experimental',
      convert: (value) => ({
        stickyScroll: {
          enabled: value,
        },
      }),
    },
  ],

  /**
   * 是否强行readonly
   */
  [
    'editor.forceReadOnly',
    {
      monaco: 'readOnly',
      convert: (value: boolean) => {
        if (value) {
          return true;
        } else {
          return undefined;
        }
      },
    },
  ],

  /**
   * Controls whether characters are highlighted that can be confused with basic ASCII characters
   */
  ['editor.unicodeHighlight', { monaco: 'unicodeHighlight' }],
]);

export const textModelUpdateOptionsConverters: Map<KaitianPreferenceKey, NoConverter | IMonacoOptionsConverter> =
  new Map<string, NoConverter | IMonacoOptionsConverter>([
    ['editor.tabSize', { monaco: 'tabSize' }],
    ['editor.indentSize', { monaco: 'indentSize' }],
    ['editor.insertSpaces', { monaco: 'insertSpaces' }],
    ['editor.trimAutoWhitespace', { monaco: 'trimAutoWhitespace' }],
  ]);

export const diffEditorOptionsConverters: Map<KaitianPreferenceKey, NoConverter | IMonacoOptionsConverter> = new Map<
  string,
  NoConverter | IMonacoOptionsConverter
>([
  /**
   * Allow the user to resize the diff editor split view.
   * Defaults to true.
   */
  ['diffEditor.enableSplitViewResizing', { monaco: 'enableSplitViewResizing' }],
  /**
   * Render the differences in two side-by-side editors.
   * Defaults to true.
   */
  ['diffEditor.renderSideBySide', { monaco: 'renderSideBySide' }],
  /**
   * Compute the diff by ignoring leading/trailing whitespace
   * Defaults to true.
   */
  ['diffEditor.ignoreTrimWhitespace', { monaco: 'ignoreTrimWhitespace' }],
  /**
   * Render +/- indicators for added/deleted changes.
   * Defaults to true.
   */
  ['diffEditor.renderIndicators', { monaco: 'renderIndicators' }],
  /**
   * Original model should be editable?
   * Defaults to false.
   */
  ['diffEditor.originalEditable', { monaco: 'originalEditable' }],

  [
    'diffEditor.minimap',
    {
      monaco: 'minimap',
      convert: (value: any) => ({
        enabled: value,
      }),
    },
  ],
]);

function isContainOptionKey(key: string, optionMap: Map<KaitianPreferenceKey, NoConverter | IMonacoOptionsConverter>) {
  if (optionMap.has(key)) {
    return true;
  } else {
    // 处理 "包含" 情况下的配置判断，如
    // editor.suggest.xxx
    const keys = optionMap.keys();
    for (const k of keys) {
      if (key.startsWith(k)) {
        return true;
      }
    }
  }
  return false;
}

export function isEditorOption(key: string) {
  return (
    isContainOptionKey(key, editorOptionsConverters) ||
    isContainOptionKey(key, textModelUpdateOptionsConverters) ||
    isContainOptionKey(key, diffEditorOptionsConverters)
  );
}

export function isDiffEditorOption(key: string): boolean {
  return isContainOptionKey(key, diffEditorOptionsConverters);
}
