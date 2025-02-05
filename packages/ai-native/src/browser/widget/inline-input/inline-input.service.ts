import { Autowired, Injectable } from '@opensumi/di';
import { KeybindingRegistry } from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Disposable, Emitter, Event, IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor, Position, Selection } from '@opensumi/ide-monaco';

import { LanguageParserService } from '../../languages/service';
import { ERunStrategy, IInteractiveInputHandler, IInteractiveInputRunStrategy } from '../../types';

import { InteractiveInputModel } from './model';

@Injectable()
export class InlineInputService extends Disposable {
  @Autowired(KeybindingRegistry)
  private readonly keybindingRegistry: KeybindingRegistry;

  @Autowired(LanguageParserService)
  private readonly languageParserService: LanguageParserService;

  private interactiveInputModel: InteractiveInputModel = new InteractiveInputModel();

  private readonly _onInteractiveInputVisibleInPosition = new Emitter<Position | undefined>();
  public readonly onInteractiveInputVisibleInPosition: Event<Position | undefined> =
    this._onInteractiveInputVisibleInPosition.event;

  private readonly _onInteractiveInputVisibleInSelection = new Emitter<Selection | undefined>();
  public readonly onInteractiveInputVisibleInSelection: Event<Selection | undefined> =
    this._onInteractiveInputVisibleInSelection.event;

  private readonly _onHidden = new Emitter<void>();
  public readonly onHidden: Event<void> = this._onHidden.event;

  public visibleByPosition(position: Position): void {
    this._onInteractiveInputVisibleInPosition.fire(position);
  }

  public visibleBySelection(selection: Selection): void {
    this._onInteractiveInputVisibleInSelection.fire(selection);
  }

  public async visibleByNearestCodeBlock(position: Position, monacoEditor: ICodeEditor): Promise<void> {
    const codeBlock = await this.findNearestCodeBlockWithPosition(position, monacoEditor);
    if (codeBlock) {
      this.visibleBySelection(codeBlock);
    }
  }

  public hide(): void {
    this._onHidden.fire();
  }

  public getInteractiveInputHandler(): IInteractiveInputHandler | undefined {
    return this.interactiveInputModel.handler();
  }

  public getInteractiveInputStrategyHandler() {
    return this.interactiveInputModel.strategyHandler();
  }

  // 根据光标位置自动检测并选中临近的代码块
  private async findNearestCodeBlockWithPosition(
    position: Position,
    monacoEditor: ICodeEditor,
  ): Promise<Selection | undefined> {
    const editorModel = monacoEditor.getModel();
    const cursor = editorModel?.getOffsetAt(position);
    const language = editorModel?.getLanguageId();
    const parser = this.languageParserService.createParser(language!);
    const codeBlock = await parser?.findNearestCodeBlockWithPosition(editorModel?.getValue() || '', cursor!);

    if (codeBlock) {
      return new Selection(
        codeBlock.range.start.line + 1,
        codeBlock.range.start.character,
        codeBlock.range.end.line + 1,
        codeBlock.range.end.character,
      );
    }

    return undefined;
  }

  public getSequenceKeyString() {
    const keybindings = this.keybindingRegistry.getKeybindingsForCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id);
    const resolved = keybindings[0]?.resolved;
    if (!resolved) {
      return '';
    }
    return this.keybindingRegistry.acceleratorForSequence(resolved, '+');
  }

  public registerInlineInput(
    runStrategy: IInteractiveInputRunStrategy,
    handler: IInteractiveInputHandler,
  ): IDisposable {
    this.interactiveInputModel.setHandler(handler);

    if (runStrategy.handleStrategy) {
      this.interactiveInputModel.setStrategyHandler(runStrategy.handleStrategy);
    } else {
      this.interactiveInputModel.setStrategyHandler(() => runStrategy.strategy || ERunStrategy.EXECUTE);
    }

    return this.interactiveInputModel;
  }
}
