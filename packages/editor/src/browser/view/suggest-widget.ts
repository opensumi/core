import { Autowired, Injectable } from '@opensumi/di';
import { DisposableCollection, PreferenceService, SuggestEvent } from '@opensumi/ide-core-browser';
import { IEventBus } from '@opensumi/ide-core-common';
import { SuggestController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/browser/suggestController';

import { IEditor } from '../../common';
import { IEditorFeatureContribution } from '../types';

@Injectable()
export class EditorSuggestWidgetContribution implements IEditorFeatureContribution {
  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  contribute(editor: IEditor) {
    const disposable = new DisposableCollection();
    const suggestController = editor.monacoEditor.getContribution<SuggestController>(SuggestController.ID);
    if (suggestController && suggestController.widget && suggestController.widget.value) {
      const suggestWidget = suggestController.widget.value;
      // FIXME: 仅通过鼠标选中会走onDidSelect事件，键盘会过acceptSelectedSuggestionOnEnter这个command
      disposable.push(
        suggestWidget.onDidSelect((e) => {
          this.eventBus.fire(
            new SuggestEvent({
              eventType: 'onDidSelect',
              data: e,
            }),
          );
        }),
      );
      disposable.push(
        suggestWidget.onDidHide((e) => {
          this.eventBus.fire(
            new SuggestEvent({
              eventType: 'onDidHide',
              data: e,
            }),
          );
        }),
      );
      disposable.push(
        suggestWidget.onDidShow((e) => {
          this.eventBus.fire(
            new SuggestEvent({
              eventType: 'onDidShow',
              data: e,
            }),
          );
        }),
      );
      disposable.push(
        suggestWidget.onDidFocus((e) => {
          this.eventBus.fire(
            new SuggestEvent({
              eventType: 'onDidFocus',
              data: e,
            }),
          );
        }),
      );

      /**
       * 控制 suggestController 的默认行为，如 `suggest details 默认展开`
       */
      // @ts-ignore
      if (suggestWidget && suggestWidget._setDetailsVisible) {
        // @ts-ignore
        suggestWidget._setDetailsVisible(this.preferenceService.get('editor.suggest.details.visible', true));
      }
    }

    return disposable;
  }
}
