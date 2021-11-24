import { SuggestWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/suggestWidget';
import { SuggestController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/suggest/suggestController';
import { Autowired, Injectable } from '@opensumi/di';
import { IEventBus } from '@opensumi/ide-core-common';
import { SuggestEvent, DisposableCollection } from '@opensumi/ide-core-browser';

import { IEditorFeatureContribution } from '../types';
import { IEditor } from '../../common';

@Injectable()
export class EditorSuggestWidgetContribution implements IEditorFeatureContribution {
  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  contribute(editor: IEditor) {
    const disposable = new DisposableCollection();
    const suggestController = editor.monacoEditor.getContribution<SuggestController>('editor.contrib.suggestController');
    if (suggestController && suggestController['_widget']) {
      const suggestWidget = (suggestController['_widget'] as any).getValue() as SuggestWidget;
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
