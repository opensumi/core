import { Autowired, Injectable } from '@opensumi/di';
import { SuggestEvent, DisposableCollection } from '@opensumi/ide-core-browser';
import { IEventBus } from '@opensumi/ide-core-common';
import { SuggestController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/suggestController';

import { IEditor } from '../../common';
import { IEditorFeatureContribution } from '../types';

@Injectable()
export class EditorSuggestWidgetContribution implements IEditorFeatureContribution {
  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

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
    }

    return disposable;
  }
}
