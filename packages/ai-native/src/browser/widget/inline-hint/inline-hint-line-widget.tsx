import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Disposable, formatLocalize } from '@opensumi/ide-core-common';
import { ICodeEditor, IPosition, Range } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { IThemeService, getColorRegistry, inputPlaceholderForeground } from '@opensumi/ide-theme';
import { ICodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorService';

const INLINE_HINT_DESCRIPTION = 'inline_hint_description';
const INLINE_HINT_DESCRIPTION_KEY = 'inline_hint_description_key';

@Injectable({ multiple: true })
export class InlineHintLineDecoration extends Disposable {
  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  private colorRegister = getColorRegistry();

  constructor(private readonly monacoEditor: ICodeEditor) {
    super();

    const codeEditorService = StandaloneServices.get(ICodeEditorService);
    codeEditorService.registerDecorationType(INLINE_HINT_DESCRIPTION, INLINE_HINT_DESCRIPTION_KEY, {
      isWholeLine: true,
    });

    this.addDispose(
      Disposable.create(() => {
        this.monacoEditor.setDecorationsByType(INLINE_HINT_DESCRIPTION, INLINE_HINT_DESCRIPTION_KEY, []);
      }),
    );
  }

  private getSequenceKeyString(separator = '+') {
    const keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id);
    const resolved = keybindings[0]?.resolved;
    if (!resolved) {
      return '';
    }
    return this.keybindingRegistry.acceleratorForSequence(resolved, separator);
  }

  public async show(position: IPosition) {
    const content = formatLocalize('aiNative.inline.hint.widget.placeholder', this.getSequenceKeyString(''));

    const theme = await this.themeService.getCurrentTheme();
    const color = this.colorRegister.resolveDefaultColor(inputPlaceholderForeground, theme);

    this.monacoEditor.setDecorationsByType(INLINE_HINT_DESCRIPTION, INLINE_HINT_DESCRIPTION_KEY, [
      {
        range: Range.fromPositions(position),
        renderOptions: {
          after: {
            contentText: content,
            opacity: '0.5',
            color: color?.toString() ?? '',
            padding: '0 0 0 12px',
            width: 'max-content',
            fontFamily: '-apple-system,BlinkMacSystemFont,PingFang SC,Hiragino Sans GB,sans-serif',
          },
        },
      },
    ]);
  }
}
