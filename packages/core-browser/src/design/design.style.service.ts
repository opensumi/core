import cls from 'classnames';

import { Injectable } from '@opensumi/di';

import { IDesignStyleService, TDesignStyles } from './types';

const prefix = 'design-';

@Injectable()
export class DesignStyleService implements IDesignStyleService {
  private _styles: TDesignStyles;

  get styles() {
    return this._styles;
  }

  setStyles(model: TDesignStyles) {
    this._styles = model;
  }

  getStyles(className: string, defaultStyle?: string): string {
    if (!this._styles) {
      return defaultStyle || '';
    }

    // design 模块的样式需要添加 design 前缀
    if (!className.startsWith(prefix)) {
      className = prefix + className;
    }

    return cls(defaultStyle, this._styles[className]);
  }
}
