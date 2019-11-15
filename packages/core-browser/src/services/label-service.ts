import { Autowired, Injectable } from '@ali/common-di';
import { URI, MaybePromise, DataUri, addElement, IDisposable, LRUMap } from '@ali/ide-core-common';
import classnames from 'classnames';
import { getIcon } from '../icon';

export interface ILabelProvider {

  /**
   * 判断该Contribution是否能处理该类型，返回权重
   */
  canHandle(element: URI, options?: ILabelOptions): number;

  /**
   * 根据URI返回Icon样式.
   */
  getIcon?(element: URI, options?: ILabelOptions): string;

  /**
   * 返回短名称.
   */
  getName?(element: URI): string;

  /**
   * 返回长名称.
   */
  getLongName?(element: URI): string;

}

export interface ILabelOptions {
  isDirectory?: boolean;
  isOpenedDirectory?: boolean;
  isSymbolicLink?: boolean;
}

function serializeLabelOptions(options?: ILabelOptions): string {
  if (!options) {
    return '';
  } else {
    return [options.isDirectory ? '0' : '1', options.isOpenedDirectory ? '0' : '1', options.isSymbolicLink ? '0' : '1'].join('');
  }
}

@Injectable()
export class DefaultUriLabelProvider implements ILabelProvider {

  canHandle(uri: object, options?: ILabelOptions): number {
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
  public defaultLabelProvider: DefaultUriLabelProvider;

  private providers: ILabelProvider[] = [];

  private cachedProviderMap: Map<string, ILabelProvider> = new LRUMap<string, ILabelProvider>(300, 200);

  constructor() {
    this.registerLabelProvider(this.defaultLabelProvider);
  }

  private getProviderForUri(uri: URI, options?: ILabelOptions): ILabelProvider | undefined {
    const key = uri.toString() + serializeLabelOptions(options);
    if (this.cachedProviderMap.has(key)) {
      return this.cachedProviderMap.get(key);
    } else {
      let candidate: ILabelProvider | undefined;
      let currentWeight: number = -1;
      for (const provider of this.providers) {
        const weight = provider.canHandle(uri, options);
        if (weight > currentWeight) {
          candidate = provider;
          currentWeight = weight;
        }
      }
      this.cachedProviderMap.set(key, candidate!);
      return candidate;
    }
  }

  registerLabelProvider(provider: ILabelProvider): IDisposable {
    this.cachedProviderMap.clear();
    return addElement(this.providers, provider, true);
  }

  getIcon(uri: URI, options?: ILabelOptions): string {
    const provider = this.getProviderForUri(uri, options);
    if (provider) {
      return provider.getIcon!(uri, options);
    } else {
      return '';
    }
  }

  getName(uri: URI): string {
    const provider = this.getProviderForUri(uri);
    if (provider) {
      return provider.getName!(uri);
    } else {
      return '';
    }
  }

  getLongName(uri: URI): string {
    const provider = this.getProviderForUri(uri);
    if (provider) {
      return provider.getLongName!(uri);
    } else {
      return '';
    }
  }

}

let modeService: any;
let modelService: any;
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
