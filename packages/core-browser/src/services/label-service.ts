import { Autowired, Injectable } from '@ali/common-di';
import { URI, MaybePromise } from '@ali/ide-core-common';
import classnames from 'classnames';
// FIXME 使用icon-theme
export const FOLDER_ICON = 'iconfont iconfolder-fill';
export const FOLDER_OPEN_ICON = 'iconfont iconfolder-fill';
export const FILE_ICON = 'iconfont iconellipsis';

export const LabelProviderContribution = Symbol('LabelProviderContribution');
export interface LabelProviderContribution {

  /**
   * 判断该Contribution是否能处理该类型，返回权重
   */
  canHandle(element: object): number;

  /**
   * 根据URI返回Icon样式.
   */
  getIcon?(element: object): MaybePromise<string>;

  /**
   * 返回短名称.
   */
  getName?(element: object): string;

  /**
   * 返回长名称.
   */
  getLongName?(element: object): string;

}

export interface ILabelOptions {
  isDirectory?: boolean;
  isOpenedDirectory?: boolean;
  isSymbolicLink?: boolean;
}

@Injectable()
export class DefaultUriLabelProviderContribution implements LabelProviderContribution {

  canHandle(uri: object): number {
    if (uri instanceof URI) {
      return 1;
    }
    return 0;
  }

  getIcon(uri: URI, options?: ILabelOptions): string {
    const iconClass = this.getFileIcon(uri);
    if (options && options.isOpenedDirectory) {
      return FOLDER_OPEN_ICON;
    }
    if (options && options.isDirectory) {
      return FOLDER_ICON;
    }
    return iconClass || FILE_ICON;
  }

  getName(uri: URI): string {
    return uri.displayName;
  }

  getLongName(uri: URI): string {
    return uri.path.toString();
  }

  protected getFileIcon(uri: URI): string | undefined {
    return getFileIconClass(uri);
  }
}

@Injectable()
export class LabelService {
  @Autowired()
  public LabelProviderContribution: DefaultUriLabelProviderContribution;

  getIcon(uri: URI, options?: ILabelOptions): string {
    return this.LabelProviderContribution!.getIcon(uri, options);
  }

  getName(uri: URI): string {
    return this.LabelProviderContribution!.getName(uri);
  }

  getLongName(uri: URI): string {
    return this.LabelProviderContribution!.getLongName(uri);
  }

}

function getFileIconClass(uri: URI) {
  const name = uri.displayName;
  const parts = name.split('.');
  const ext = parts.length > 0 ? '.' + parts[parts.length - 1] : null;

  return classnames({
    ['fileIcon']: true,
    ['normal']: true,
    ['default']: true,
    ['ts']: ext === '.ts',
    ['js']: ext === '.js' || ext === '.sjs',
    ['less']: ext === '.less',
    ['css']: ext === '.css' || ext === '.acss',
    ['html']: ext === '.html' || ext === '.axml' || ext === '.xml',
    ['json']: ext === '.json',
    ['config']: ext === '.babelrc' || ext === '.schema',
    ['markdown']: ext === '.md',
    ['image']: ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif',
    ['gitignore']: name === '.gitignore',
    ['java']: ext === '.java' || ext === '.class',
    ['tsx']: ext === '.tsx',
  });
}
