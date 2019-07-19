import { Injectable } from '@ali/common-di';
import { ICSSStyleService } from '../common/style';

@Injectable()
export class CSSStyleService implements ICSSStyleService {

  private styleSheet: CSSStyleSheet;

  constructor() {
    const style = document.createElement('style');
    document.body.appendChild(style);
    this.styleSheet = style.sheet as CSSStyleSheet;
  }

  addClass(classname: string, style: CSSStyleDeclaration) {
    const _style = document.createElement('div').style;
    Object.assign(_style, style);
    this.styleSheet.insertRule([`.${classname} {`, _style.cssText, '}'].join(' '));
    return {
      dispose: () => {
        this.removeClass(classname);
      },
    };
  }

  removeClass(classname: string) {
    for (let i = this.styleSheet.rules.length - 1; i >= 0; i --) {
      if ((this.styleSheet.rules[i] as any).selectorText === '.' + classname) {
        this.styleSheet.removeRule(i);
      }
    }
  }
}
