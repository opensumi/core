import warning from '../../utils/warning';

import { defaultIconfont } from './iconMap';
export { defaultIconfont };

/**
 * 以下为 typo 的字体，做一定兼容
 * key 为 iconName enum, value 为 icon className
 */
const typoIconMap = {
  'folder-fill-open': 'folder-fill',
  'search-close': 'close-square',
  'fold': 'collapse-all',
  'setting-general': 'setting',
  'setting-editor': 'codelibrary-fill',
  'setting-file': 'file-text',
  'setting-extension': 'extension',
  'run-debug': 'start',
  'toggle-breakpoints': 'deactivate-breakpoints',
  // new typos issue
  'withdraw': 'fallback',
  'terminate1': 'stop',
  'stop1': 'stop',
  'add': 'plus',
  // removed duplicated icons
  'rundebug': 'start',
  'terminate': 'stop',
};

const _defaultIconAndTypoIconMap = Object.assign({}, defaultIconfont, typoIconMap);

export const defaultIconMap = new Proxy(_defaultIconAndTypoIconMap, {
  get(obj, prop: string) {
    const typoValue = typoIconMap[prop];
    warning(!typoValue, `Icon '${prop}' was a typo, please use '${typoValue}' instead`);
    return obj[prop];
  },
});

class IconManager {
  private _ktIconPrefixes: string[] = [];

  private _iconMap: { [iconPrefix: string]: { [iconKey: string]: string } } = {};

  update(prefix: string, customIconMap: { [iconKey: string]: string }) {
    this._iconMap[prefix] = customIconMap;
    this._ktIconPrefixes.push(prefix);
  }

  getIconClx(iconKey: string): string[] {
    if (!iconKey) {
      warning(false, 'not a valid icon key:' + iconKey);
      return [];
    }
    let lastIndex = this._ktIconPrefixes.length;
    while (!this._iconMap[this._ktIconPrefixes[--lastIndex]][iconKey]) {
      if (lastIndex === 0) { break; }
    }
    const iconValue = this._iconMap[this._ktIconPrefixes[lastIndex]][iconKey];

    if (!iconValue) {
      warning(false, '图标库缺失图标:' + iconKey);
      return [];
    }
    return [`${this._ktIconPrefixes[lastIndex]}${iconValue}`];
  }
}

export const iconManager = new IconManager();

const defaultKtIconPrefix = 'kaitian-icon kticon-';
// 将 default 的部分先配置进去
iconManager.update(defaultKtIconPrefix, defaultIconMap);
