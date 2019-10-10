import { Autowired, Injectable } from '@ali/common-di';
import { URI, MaybePromise } from '@ali/ide-core-common';
import classnames from 'classnames';
import { getIcon } from '../icon';

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

  // TODO 运行时获取
  getIcon(uri: URI, options?: ILabelOptions): string {
    const iconClass = getIconClass(uri, options);
    return iconClass || getIcon('ellipsis');
  }

  getName(uri: URI): string {
    return uri.displayName;
  }

  getLongName(uri: URI): string {
    return uri.path.toString();
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

// TODO 支持metadata、name判断
const getIconClass = (uri: URI, options?: ILabelOptions) => {
  const name = uri.displayName;
  const classes = options && options.isDirectory ? ['folder-icon'] : ['file-icon'];
  // Name & Extension(s)
  if (name) {
    classes.push(`${name}-name-file-icon`);
    const dotSegments = name.split('.');
    for (let i = 1; i < dotSegments.length; i++) {
      classes.push(`${dotSegments.slice(i).join('.')}-ext-file-icon`); // add each combination of all found extensions if more than one
    }
    classes.push(`ext-file-icon`); // extra segment to increase file-ext score
  }
  // 统一的图标类
  classes.push('icon-label');
  return classnames(classes);
};
