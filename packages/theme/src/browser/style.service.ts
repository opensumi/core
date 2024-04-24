import { Injectable } from '@opensumi/di';

import { ICSSStyleService, IStyleInsertResult, IStyleSheet } from '../common/style';

// class StyleSheet implements IStyleSheet {}

class GlobalStyleSheet implements IStyleSheet {
  private styleSheet: CSSStyleSheet;

  constructor() {
    const style = document.createElement('style');
    document.body.appendChild(style);
    this.styleSheet = style.sheet as CSSStyleSheet;
  }

  public insertSelector(selector: string, rule: string): IStyleInsertResult {
    const index = this.styleSheet.insertRule(`${selector} { ${rule} }`, this.styleSheet.cssRules.length);
    return {
      index,
      dispose: () => {
        this.styleSheet.deleteRule(index);
      },
    };
  }

  public deleteRule(index: number): void {
    this.styleSheet.deleteRule(index);
  }

  public removeClass(classname: string): void {
    for (let i = this.styleSheet.rules.length - 1; i >= 0; i--) {
      if ((this.styleSheet.rules[i] as any).selectorText === '.' + classname) {
        this.styleSheet.removeRule(i);
      }
    }
  }
}

@Injectable()
export class CSSStyleService implements ICSSStyleService {
  globalStyleSheet: GlobalStyleSheet;
  constructor() {
    this.globalStyleSheet = new GlobalStyleSheet();
  }

  acquire(key: string): IStyleSheet {
    throw new Error('Method not implemented.');
  }

  addClass(classname: string, style: Partial<CSSStyleDeclaration>) {
    const result = this.globalStyleSheet.insertSelector(`.${classname}`, createStyleCssText(style as any));
    return result;
  }

  deleteRule(index: number) {
    this.globalStyleSheet.deleteRule(index);
  }

  removeClass(classname: string) {
    this.globalStyleSheet.removeClass(classname);
  }

  _getOrCreateStyleSheet(key?: string) {}
}

function createStyleCssText(styles: { [key: string]: string | undefined }): string {
  const texts: string[] = [];
  Object.keys(styles).forEach((key) => {
    if (styles[key]) {
      texts.push(toDashSplitForm(key) + ':' + styles[key]);
    }
  });

  return texts.join(';');
}

function toDashSplitForm(key: string) {
  return key
    .trim()
    .split(/(?=[A-Z])/)
    .join('-')
    .toLowerCase();
}
