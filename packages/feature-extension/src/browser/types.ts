import { ConstructorOf } from '@ali/common-di';
import { IDisposable } from '@ali/ide-core-common';

export interface IFeatureExtension extends IDisposable {

  readonly name: string;

  readonly activated: boolean;

  readonly enabled: boolean;

  readonly packageJSON: JSONSchema;

  readonly type: IFeatureExtensionType;

  readonly extraMetadata: {
    [key: string]: string | null;
  };

}

export interface IFeatureExtensionType<T extends JSONSchema = JSONSchema> {

  readonly name: string;

  createCapability(extension: IFeatureExtension): FeatureExtensionCapability<T>;

  isThisType(packageJSON: {[key: string]: any }): boolean;
}

export abstract class FeatureExtensionCapability<T extends JSONSchema = JSONSchema> {

  protected packageJSON: T;

  constructor(protected extension: IFeatureExtension) {
    this.packageJSON = extension.packageJSON as T;
  }
  /**
   * 当插件被enable时. 返回的disposable会在disable时被调用
   */
  public abstract async onEnable(): Promise<IDisposable>;

  /**
   *  当插件被activate时。 返回的disposable会在deactivate时被调用
   */
  public abstract async onActivate(): Promise<IDisposable>;

}

export abstract class FeatureExtensionCapabilityRegistry {

  /**
   * 添加plugin扫描目录
   * @param dir
   */
  public abstract addFeatureExtensionScanDirectory(dir: string): IDisposable;

  /**
   * 添加目录
   * @param dir
   */
  public abstract addFeatureExtensionCandidate(dir: string): IDisposable;

  /**
   * 扫描时获取额外文件的内容
   * @param fieldName 额外内容在extraMetaData对象中的名称
   * @param relativePath 相对于插件根目录的位置
   */
  public abstract addExtraMetaData(fieldName: string, relativePath: string): IDisposable;

  /**
   * 注册一个项目类型
   * @param IFeatureExtensionType
   */
  public abstract registerFeatureExtensionType(type: IFeatureExtensionType): IDisposable;

}

export abstract class FeatureExtensionProcessManage {
  public abstract create(): any;
}

export abstract class FeatureExtensionManagerService {

  /**
   * 启动插件服务
   */
  public abstract activate(): Promise<void>;

  /**
   * 创建一个插件进程
   * @param name 进程名称，唯一
   * @param preload 进程预加载代码
   * @param args 进程fork args
   * @param options 进程options
   */
  public abstract createFeatureExtensionNodeProcess(name: string, preload: string, args?: string[], options?: string[]); // 创建一个拓展js进程

  /**
   * 获得拓展信息
   */
  public abstract getFeatureExtensions(): IFeatureExtension[];

  /**
   * 获得某个拓展
   * @param name
   */
  public abstract getFeatureExtension(name: string): IFeatureExtension;

  /**
   * 获得进程
   * @param name
   */
  public abstract getFeatureExtensionNodeProcess(name: string): IFeatureExtensionNodeProcess;

  /**
   * 在browser层运行代码
   * @param scriptPath
   * @param sandboxOptions
   */
  public abstract runScriptInBrowser(scriptPath: string, sandboxOptions: ISandboxOption);

  /**
   * 在node层运行代码
   * @param scriptPath
   * @param sandboxOptions
   */
  public abstract runScriptInNode(scriptPath: string, sandboxOptions: ISandboxOption);
}

export interface IFeatureExtensionNodeProcess {
  name: string; // 这个进程的名称

  send(message: any);

  onMessage(listener: (message: any) => void);

  loadScript(scriptPath: string, sandboxOptions: ISandboxOption);

  provideRequire(name: string, modulePath: string);

}

export interface ISandboxOption {

  // todo
  allowChildProcess: boolean;

}

export interface FeatureExtensionCapabilityContribution {

  registerCapability?(registry: FeatureExtensionCapabilityRegistry): Promise<void>;

  onWillEnableFeatureExtensions?(service: FeatureExtensionManagerService): Promise<void>;

}

export const FeatureExtensionCapabilityContribution = Symbol('FeatureExtensionCapabilityContribution');

export interface JSONSchema {

  [key: string]: any;

}
