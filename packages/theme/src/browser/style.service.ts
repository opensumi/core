import { Injectable } from '@opensumi/di';

import { ICSSStyleService } from '../common/style';

@Injectable()
export class CSSStyleService implements ICSSStyleService {
  private styleSheet: CSSStyleSheet;

  constructor() {
    const style = document.createElement('style');
    document.body.appendChild(style);
    this.styleSheet = style.sheet as CSSStyleSheet;
  }

  addClass(classname: string, style: Partial<CSSStyleDeclaration>) {
    const ruleContent = [`.${classname} {`, createStyleCssText(style as any), '}'].join(' ');
    this.styleSheet.insertRule(ruleContent);
    return {
      dispose: () => {
        this.removeClass(classname);
      },
    };
  }

  removeClass(classname: string) {
    for (let i = this.styleSheet.rules.length - 1; i >= 0; i--) {
      if ((this.styleSheet.rules[i] as any).selectorText === '.' + classname) {
        this.styleSheet.removeRule(i);
      }
    }
  }
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
