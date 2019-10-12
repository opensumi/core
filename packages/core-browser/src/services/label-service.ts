import { Autowired, Injectable } from '@ali/common-di';
import { URI, MaybePromise, DataUri } from '@ali/ide-core-common';
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

let modeService: any;
let modelService: any;
// TODO 支持metadata、name判断
const getIconClass = (resource: URI, options?: ILabelOptions) => {
  const classes = options && options.isDirectory ? ['folder-icon'] : ['file-icon'];
  let name: string | undefined;
  // 获取资源的路径和名称，data-uri单独处理
  if (resource.scheme === 'data') {
    const metadata = DataUri.parseMetaData(monaco.Uri.file(resource.toString()));
    name = metadata.get(DataUri.META_DATA_LABEL);
  } else {
    name = cssEscape(basenameOrAuthority(resource).toLowerCase());
  }

  // 文件夹图标
  if (options && options.isDirectory) {
    classes.push(`${name}-name-folder-icon`);
  } else {// 文件图标
    // Name & Extension(s)
    if (name) {
      classes.push(`${name}-name-file-icon`);
      const dotSegments = name.split('.');
      for (let i = 1; i < dotSegments.length; i++) {
        classes.push(`${dotSegments.slice(i).join('.')}-ext-file-icon`); // add each combination of all found extensions if more than one
      }
      classes.push(`ext-file-icon`); // extra segment to increase file-ext score
    }
    // Language Mode探测
    if (!modeService) {
      modeService = monaco.services.StaticServices.modeService.get();
    }
    if (!modelService) {
      modelService = monaco.services.StaticServices.modelService.get();
    }
    const detectedModeId = detectModeId(modelService, modeService, monaco.Uri.file(resource.toString()));
    if (detectedModeId) {
      classes.push(`${cssEscape(detectedModeId)}-lang-file-icon`);
    }
  }
  // 统一的图标类
  classes.push('icon-label');
  return classnames(classes);
};

export function cssEscape(val: string): string {
  return val.replace(/\s/g, '\\$&'); // make sure to not introduce CSS classes from files that contain whitespace
}

export function basenameOrAuthority(resource: URI) {
  return resource.path.base || resource.authority;
}

export function detectModeId(modelService, modeService, resource: monaco.Uri): string | null {
  if (!resource) {
    return null; // we need a resource at least
  }

  let modeId: string | null = null;

  // Data URI: check for encoded metadata
  if (resource.scheme === 'data') {
    const metadata = DataUri.parseMetaData(resource);
    const mime = metadata.get(DataUri.META_DATA_MIME);

    if (mime) {
      modeId = modeService.getModeId(mime);
    }
  } else {
    const model = modelService.getModel(resource);
    if (model) {
      modeId = model.getModeId();
    }
  }

  // only take if the mode is specific (aka no just plain text)
  if (modeId && modeId !== 'plaintext') {
    return modeId;
  }

  // otherwise fallback to path based detection
  return modeService.getModeIdByFilepathOrFirstLine(resource.toString());
}
