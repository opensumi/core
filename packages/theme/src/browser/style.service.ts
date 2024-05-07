import { Injectable } from '@opensumi/di';

import { ICSSStyleService, IStyleInsertResult, IStyleSheet, emptyResult } from '../common/style';

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
        this.removeRuleBySelector(selector);
      },
    };
  }

  public removeRuleBySelector(selector: string): void {
    for (let i = this.styleSheet.cssRules.length - 1; i >= 0; i--) {
      if ((this.styleSheet.cssRules[i] as CSSStyleRule).selectorText === selector) {
        this.styleSheet.deleteRule(i);
      }
    }
  }

  public deleteRule(index: number): void {
    this.styleSheet.deleteRule(index);
  }
}

@Injectable()
export class CSSStyleService implements ICSSStyleService {
  globalStyleSheet: GlobalStyleSheet;
  constructor() {
    this.globalStyleSheet = new GlobalStyleSheet();
  }

  addClass(classname: string, style: Partial<CSSStyleDeclaration>) {
    const rule = createStyleCssText(style);
    if (!rule) {
      return emptyResult;
    }

    return this.globalStyleSheet.insertSelector(`.${classname}`, rule);
  }

  removeClass(classname: string) {
    this.globalStyleSheet.removeRuleBySelector(`.${classname}`);
  }
}

function createStyleCssText(styles: Partial<CSSStyleDeclaration>): string {
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
