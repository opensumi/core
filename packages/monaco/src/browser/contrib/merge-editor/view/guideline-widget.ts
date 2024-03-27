import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import { ICodeEditor } from '../../../monaco-api/types';
import { DECORATIONS_CLASSNAME, LineRangeType } from '../types';

export class GuidelineWidget extends ZoneWidget {
  private recordLine: number;

  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(): void {
    this.setCssClass(DECORATIONS_CLASSNAME.guide_underline_widget);
  }

  constructor(editor: ICodeEditor) {
    super(editor, {
      showArrow: false,
      showFrame: false,
      arrowColor: undefined,
      frameColor: undefined,
      // 这里有个小坑，如果不开启这个配置，那么在调用 show 函数的时候会自动对焦并滚动到对应 range，导致在编辑 result 视图中代码时光标总是滚动在最后一个 widget 上
      keepEditorSelection: true,
    });
  }

  // 覆写 revealRange 函数，使其在 show 的时候编辑器不会定位到对应位置
  protected override revealRange(range, isLastLine): void {
    // not implement
  }

  public getRecordLine(): number {
    return this.recordLine;
  }

  public setContainerStyle(style: { [key in string]: string }): void {
    const keys = Object.keys(style);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.container?.style, key)) {
        this.container!.style[key] = style[key];
      }
    }
  }

  public addClassName(type: LineRangeType | string): this {
    this.setCssClass(type);
    return this;
  }

  public showByLine(line: number): void {
    this.recordLine = line;
    super.hide();
    super.show(
      {
        startLineNumber: line,
        startColumn: 0,
        endLineNumber: line,
        endColumn: Number.MAX_SAFE_INTEGER,
      },
      0,
    );
  }
}
