import { Autowired, Injectable } from '@ali/common-di';
import { IEventBus } from '@ali/ide-core-common';
import { SuggestEvent, DisposableCollection } from '@ali/ide-core-browser';

import { IEditorFeatureContribution } from '../types';
import { IEditor } from '../../common';

@Injectable()
export class EditorSuggestWidgetContribution implements IEditorFeatureContribution {
  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  contribute(editor: IEditor) {
    const disposable = new DisposableCollection();
    const suggestController = editor.monacoEditor.getContribution('editor.contrib.suggestController') as monaco.suggestController.SuggestController;
    if (suggestController && suggestController['_widget']) {
      const suggestWidget = (suggestController['_widget'] as any).getValue() as monaco.suggestController.SuggestWidget;
      // FIXME: @寻壑 仅通过鼠标选中会走onDidSelect事件，键盘会过acceptSelectedSuggestionOnEnter这个command
      disposable.push(
        suggestWidget.onDidSelect((e) => {
          this.eventBus.fire(new SuggestEvent({
            eventType: 'onDidSelect',
            data: e,
          }));
        }),
      );
      disposable.push(
        suggestWidget.onDidHide((e) => {
          this.eventBus.fire(new SuggestEvent({
            eventType: 'onDidHide',
            data: e,
          }));
        }),
      );
      disposable.push(
        suggestWidget.onDidShow((e) => {
          this.eventBus.fire(new SuggestEvent({
            eventType: 'onDidShow',
            data: e,
          }));
        }),
      );
      disposable.push(
        suggestWidget.onDidFocus((e) => {
          this.eventBus.fire(new SuggestEvent({
            eventType: 'onDidFocus',
            data: e,
          }));
        }),
      );

    }

    return disposable;
  }
}
