import { ZoneWidget } from './zone-widget';

const TestRange = {
  startLineNumber: 3,
  endLineNumber: 7,
  startColumn: 1,
  endColumn: 1,
};

export class FoldedCodeWidget extends ZoneWidget {

  protected applyClass() {
    this._container.innerText = '测试一下渲染的内容';
  }

  protected applyStyle() {

  }

  constructor(protected readonly editor: monaco.editor.ICodeEditor) {
    super(editor);
    editor.updateOptions({
      folding: false,
    });
  }

  show(where: monaco.IRange) {
    super.show({
      startLineNumber: TestRange.startLineNumber - 2,
      endLineNumber: TestRange.startLineNumber + 2,
      startColumn: TestRange.startColumn,
      endColumn: TestRange.endColumn,
    }, 1);
    (this.editor as any)._modelData.viewModel.setHiddenAreas([where]);
  }
}
