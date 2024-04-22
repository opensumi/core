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

  wrapStyles(styles: string, key: string): string {
    if (!this._styles) {
      return styles || '';
    }

    if (!styles) {
      return '';
    }

    return cls(styles, this._styles[prefix + key]);
  }
}
