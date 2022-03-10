import classnames from 'classnames';

import { Autowired, Injectable } from '@opensumi/di';
import {
  URI,
  Emitter,
  addElement,
  IDisposable,
  LRUMap,
  Event,
  WithEventBus,
  BasicEvent,
  Disposable,
} from '@opensumi/ide-core-common';
import type { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/modelService';
import type { IModeService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/modeService';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { getIcon } from '../style/icon/icon';


/**
 * Data URI related helpers.
 */
export namespace DataUri {
  export const META_DATA_LABEL = 'label';
  export const META_DATA_DESCRIPTION = 'description';
  export const META_DATA_SIZE = 'size';
  export const META_DATA_MIME = 'mime';

  export function parseMetaData(dataUri: monaco.Uri): Map<string, string> {
    const metadata = new Map<string, string>();
    const uriPath = dataUri.path;
    // Given a URI of:  data:image/png;size:2313;label:SomeLabel;description:SomeDescription;base64,77+9UE5...
    // the metadata is: size:2313;label:SomeLabel;description:SomeDescription
    const meta = uriPath.substring(uriPath.indexOf(';') + 1, uriPath.lastIndexOf(';'));
    meta.split(';').forEach((property) => {
      const [key, value] = property.split(':');
      if (key && value) {
        metadata.set(key, value);
      }
    });

    // Given a URI of:  data:image/png;size:2313;label:SomeLabel;description:SomeDescription;base64,77+9UE5...
    // the mime is: image/png
    const mime = uriPath.substring(0, uriPath.indexOf(';'));
    if (mime) {
      metadata.set(META_DATA_MIME, mime);
    }

    return metadata;
  }
}

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

  /**
   * 通知使用方发生了变更
   */
  onDidChange?: Event<URI>;
}

export interface ILabelOptions {
  isDirectory?: boolean;
  isOpenedDirectory?: boolean;
  isSymbolicLink?: boolean;
}

export function serializeLabelOptions(options?: ILabelOptions): string {
  if (!options) {
    return 'default';
  } else {
    return [
      options.isDirectory ? '0' : '1',
      options.isOpenedDirectory ? '0' : '1',
      options.isSymbolicLink ? '0' : '1',
    ].join('');
  }
}

export function deserializeLabelOptions(key: string): ILabelOptions | undefined {
  if (key === 'default') {
    return undefined;
  } else {
    return {
      isDirectory: key[0] === '0',
      isOpenedDirectory: key[1] === '0',
      isSymbolicLink: key[2] === '0',
    };
  }
}

@Injectable()
export class DefaultUriLabelProvider extends Disposable implements ILabelProvider {
  private _onDidChange = this.registerDispose(new Emitter<URI>());

  public onDidChange = this._onDidChange.event;

  public canHandle(uri: object, options?: ILabelOptions): number {
    if (uri instanceof URI) {
      return 1;
    }
    return 0;
  }

  public getIcon(uri: URI, options?: ILabelOptions): string {
    const { iconClass, onDidChange } = getIconClass(uri, options);
    if (onDidChange) {
      const disposer = onDidChange(() => {
        this._onDidChange.fire(uri);
        disposer.dispose();
      });
      this.addDispose(disposer);
    }
    return iconClass || getIcon('ellipsis');
  }

  public getName(uri: URI): string {
    return uri.displayName;
  }

  public getLongName(uri: URI): string {
    return uri.path.toString();
  }
}

interface ICachedLabelProvider {
  [option: string]: ILabelProvider | undefined;
}

@Injectable()
export class LabelService extends WithEventBus {
  @Autowired()
  public defaultLabelProvider: DefaultUriLabelProvider;

  private providers: ILabelProvider[] = [];

  private cachedProviderMap: Map<string, ICachedLabelProvider> = new LRUMap<string, ICachedLabelProvider>(1000, 500);

  private onDidChangeEmitter: Emitter<URI> = new Emitter();

  constructor() {
    super();
    this.registerLabelProvider(this.defaultLabelProvider);
  }

  get onDidChange() {
    return this.onDidChangeEmitter.event;
  }

  private getProviderForUri(uri: URI, options?: ILabelOptions): ILabelProvider | undefined {
    const uriKey = uri.toString();
    if (!this.cachedProviderMap.has(uriKey)) {
      this.cachedProviderMap.set(uriKey, {});
    }
    const cached = this.cachedProviderMap.get(uriKey)!;
    const optionKey = serializeLabelOptions(options);
    if (cached[optionKey]) {
      return cached[optionKey];
    } else {
      let candidate: ILabelProvider | undefined;
      let currentWeight = -1;
      for (const provider of this.providers) {
        const weight = provider.canHandle(uri, options);
        if (weight > currentWeight) {
          candidate = provider;
          currentWeight = weight;
        }
      }
      cached[optionKey] = candidate;
      return candidate;
    }
  }

  public registerLabelProvider(provider: ILabelProvider): IDisposable {
    const currentProvided = Array.from(this.cachedProviderMap.entries());
    this.cachedProviderMap.clear();
    const disposer = new Disposable();
    if (provider.onDidChange) {
      disposer.addDispose(
        provider.onDidChange((uri) => {
          this.onDidChangeEmitter.fire(uri);
          this.cachedProviderMap.delete(uri.toString());
        }),
      );
    }
    disposer.addDispose(addElement(this.providers, provider, true));
    disposer.addDispose({
      dispose: () => {
        this.cachedProviderMap.clear();
      },
    });
    /**
     * 对于已经提供过 icon label的，如果发生改变, 通知一遍已经改变
     */
    currentProvided.forEach(([uriString, prev]) => {
      const uri = new URI(uriString);
      for (const key of Object.keys(prev)) {
        const options = deserializeLabelOptions(key);
        const newProvider = this.getProviderForUri(uri, options);
        if (newProvider !== prev[key]) {
          this.onDidChangeEmitter.fire(uri);
          return;
        }
      }
    });

    return disposer;
  }

  public getIcon(uri: URI, options?: ILabelOptions): string {
    const provider = this.getProviderForUri(uri, options);
    if (provider) {
      return provider.getIcon!(uri, options);
    } else {
      return '';
    }
  }

  public getName(uri: URI): string {
    const provider = this.getProviderForUri(uri);
    if (provider) {
      return provider.getName!(uri);
    } else {
      return '';
    }
  }

  public getLongName(uri: URI): string {
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
const getIconClass = (
  resource: URI,
  options?: ILabelOptions,
): {
  iconClass: string;
  onDidChange?: Event<void>;
} => {
  const classes = options && options.isDirectory ? ['folder-icon'] : ['file-icon'];
  let name: string | undefined;
  // 获取资源的路径和名称，data-uri单独处理
  if (resource.scheme === 'data') {
    const metadata = DataUri.parseMetaData(monaco.Uri.file(resource.toString()));
    name = metadata.get(DataUri.META_DATA_LABEL);
  } else {
    name = cssEscape(basenameOrAuthority(resource).toLowerCase());
  }

  let _onDidChange: Emitter<void> | undefined;
  // 文件夹图标
  if (options && options.isDirectory) {
    classes.push(`${name}-name-folder-icon`);
  } else {
    // 文件图标
    // Name & Extension(s)
    if (name) {
      classes.push(`${name}-name-file-icon`);
      const dotSegments = name.split('.');
      for (let i = 1; i < dotSegments.length; i++) {
        classes.push(`${dotSegments.slice(i).join('.')}-ext-file-icon`); // add each combination of all found extensions if more than one
      }
      classes.push('ext-file-icon'); // extra segment to increase file-ext score
    }
    // Language Mode探测
    if (!modeService) {
      modeService = StaticServices.modeService.get();
    }
    if (!modelService) {
      modelService = StaticServices.modelService.get();
    }
    const detectedModeId = detectModeId(modelService, modeService, monaco.Uri.file(resource.withoutQuery().toString()));
    if (detectedModeId) {
      classes.push(`${cssEscape(detectedModeId)}-lang-file-icon`);
    } else {
      _onDidChange = new Emitter<void>();
      StaticServices.modeService.get().onDidEncounterLanguage(() => {
        if (detectModeId(modelService, modeService, monaco.Uri.file(resource.withoutQuery().toString()))) {
          _onDidChange?.fire();
          _onDidChange?.dispose();
        }
      });
    }
  }
  // 统一的图标类
  classes.push('icon-label');
  return {
    iconClass: classnames(classes),
    // 对于首次没找到的，添加一个检测新语言注册的 change 事件
    onDidChange: _onDidChange?.event,
  };
};

export function cssEscape(str: string): string {
  return str.replace(/[\11\12\14\15\40]/g, '/'); // HTML class names can not contain certain whitespace characters, use / instead, which doesn't exist in file names.
}

export function basenameOrAuthority(resource: URI) {
  return resource.path.base || resource.authority;
}

export function detectModeId(
  modelService: IModelService,
  modeService: IModeService,
  resource: monaco.Uri,
): string | null {
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
  return modeService.getModeIdByFilepathOrFirstLine(resource);
}

export function getLanguageIdFromMonaco(uri: URI) {
  modeService = StaticServices.modeService.get();
  modelService = StaticServices.modelService.get();
  return detectModeId(modelService, modeService, monaco.Uri.parse(uri.toString()));
}

/**
 * labelService所处理的label或者icon变更的事件
 */
export class ResourceLabelOrIconChangedEvent extends BasicEvent<URI> {}
