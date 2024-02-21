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

  wrapStyles(styles?: string): string {
    if (!this._styles) {
      return styles || '';
    }

    if (!styles) {
      return '';
    }

    let _cls = styles.replace(/___\w{5}/, '');

    // design 模块的样式需要添加 design 前缀
    if (!_cls.startsWith(prefix)) {
      _cls = prefix + _cls;
    }

    return cls(styles, this._styles[_cls]);
  }
}
