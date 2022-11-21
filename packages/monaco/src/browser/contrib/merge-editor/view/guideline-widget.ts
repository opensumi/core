import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';

import { LineRangeType } from '../types';

export class GuidelineWidget extends ZoneWidget {
  protected applyClass(): void {}
  protected applyStyle(): void {}

  protected _fillContainer(): void {
    this.setCssClass('merge-editor-guide-underline-widget');
  }

  public setContainerStyle(style: { [key in string]: string }): void {
    const keys = Object.keys(style);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.container?.style, key)) {
        this.container!.style[key] = style[key];
      }
    }
  }

  public setLineRangeType(type: LineRangeType): this {
    this.setCssClass(type);
    return this;
  }

  public showByLine(line: number): void {
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
