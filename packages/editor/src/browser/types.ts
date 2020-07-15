import { IResource, ResourceService, IEditorGroup, IDecorationRenderOptions, ITextEditorDecorationType, TrackedRangeStickiness, OverviewRulerLane, IEditorOpenType, IEditor, DragOverPosition } from '../common';
import { MaybePromise, IDisposable, BasicEvent, IRange, MaybeNull, ISelection, URI, Event } from '@ali/ide-core-browser';
import { IThemeColor } from '@ali/ide-theme/lib/common/color';
import { IEditorDocumentModelContentRegistry } from './doc-model/types';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next';
export * from '../common';

export type ReactEditorComponent<MetaData = any> = React.ComponentClass<{resource: IResource<MetaData>}> | React.FunctionComponent<{resource: IResource<MetaData>}>;

export interface IEditorComponent<MetaData = any> {

  // 唯一id
  uid: string;

  // component 对象
  component: ReactEditorComponent<MetaData>;

  // 要被handle的scheme
  // @deprecated
  scheme?: string;

  // 渲染模式 默认为 ONE_PER_GROUP
  renderMode?: EditorComponentRenderMode;

}

export enum EditorComponentRenderMode {
  ONE_PER_RESOURCE = 1, // 每个resource渲染一个新的
  ONE_PER_GROUP = 2, // 每个Group最多存在一个新的
  ONE_PER_WORKBENCH = 3, // 整个IDE只有一个, 视图会被重用
}

/**
 * 注册编辑器组件 Resolver 时触发
 */
export class RegisterEditorComponentResolverEvent extends BasicEvent<string> {}

export abstract class EditorComponentRegistry {

  abstract registerEditorComponent<T>(component: IEditorComponent<T>, initialProps?: any): IDisposable;

  // 等同于 handlesScheme => 10
  abstract registerEditorComponentResolver<T>(scheme: string , resolver: IEditorComponentResolver<T>): IDisposable;

  // handlesScheme 返回权重， 小于 0 表示不处理
  // tslint:disable-next-line: unified-signatures
  abstract registerEditorComponentResolver<T>(handlesScheme: (scheme: string) => number, resolver: IEditorComponentResolver<T>): IDisposable;

  abstract resolveEditorComponent(resource: IResource): Promise<IEditorOpenType[]>;

  abstract getEditorComponent(id: string): IEditorComponent | null;

  abstract getEditorInitialProps(id: string): any;

  abstract clearPerWorkbenchComponentCache(componentId: string): void;
}

/**
 * 打开资源的处理委派函数
 * @param resource 要打开的资源
 * @param results 在执行此责任委派函数前，已经支持的打开方式
 * @param resolve 调用这个函数，传入结果可结束责任链直接返回支持的打开方式
 */
export type IEditorComponentResolver<MetaData = any> =
  (resource: IResource<MetaData>, results: IEditorOpenType[], resolve: (results: IEditorOpenType[]) => void) => MaybePromise<void>;

export const BrowserEditorContribution = Symbol('BrowserEditorContribution');

export interface BrowserEditorContribution {

  registerResource?(resourceService: ResourceService): void;

  registerEditorComponent?(editorComponentRegistry: EditorComponentRegistry): void;

  registerEditorDocumentModelContentProvider?(registry: IEditorDocumentModelContentRegistry): void;

  registerEditorActions?(editorActionRegistry: IEditorActionRegistry): void;

  onDidRestoreState?(): void;

  registerEditorFeature?(registry: IEditorFeatureRegistry);

}

export interface IGridResizeEventPayload {
  gridId: string;
}

export class GridResizeEvent extends BasicEvent<IGridResizeEventPayload> {}

export class EditorGroupOpenEvent extends BasicEvent<{group: IEditorGroup, resource: IResource}> {}
export class EditorGroupCloseEvent extends BasicEvent<{group: IEditorGroup, resource: IResource}> {}
export class EditorGroupDisposeEvent extends BasicEvent<{group: IEditorGroup}> {}

export class EditorGroupChangeEvent extends BasicEvent<IEditorGroupChangePayload> {}

export interface IEditorGroupChangePayload {

  group: IEditorGroup;

  oldResource: MaybeNull<IResource>;

  newResource: MaybeNull<IResource>;

  oldOpenType: MaybeNull<IEditorOpenType>;

  newOpenType: MaybeNull<IEditorOpenType>;

}

export class EditorGroupFileDropEvent extends BasicEvent<IEditorGroupFileDropPayload> {}

export interface IEditorGroupFileDropPayload {

  files: FileList;

  group: IEditorGroup;

  /**
   * 如果目标在tab上, drop目标tab的位置
   * -1表示在tab的空位置
   */
  tabIndex?: number;

  /**
   * 如果扔在编辑器主体，扔的位置
   */
  position?: DragOverPosition;
}

export interface IEditorDecorationCollectionService {
  createTextEditorDecorationType(options: IDecorationRenderOptions, key?: string): IBrowserTextEditorDecorationType;
  getTextEditorDecorationType(key): IBrowserTextEditorDecorationType | undefined;
  registerDecorationProvider(provider: IEditorDecorationProvider): IDisposable;
  getDecorationFromProvider(uri: URI, key?: string): Promise<{[key: string]: monaco.editor.IModelDeltaDecoration[]}>;
}

export interface IBrowserTextEditorDecorationType extends ITextEditorDecorationType {
  property: IDynamicModelDecorationProperty;
}

export interface IDynamicModelDecorationProperty extends IDisposable {

  default: IThemedCssStyle;

  light: IThemedCssStyle | null;

  dark: IThemedCssStyle | null;

  rangeBehavior?: TrackedRangeStickiness;

  overviewRulerLane?: OverviewRulerLane;

  isWholeLine: boolean;

}

export interface IThemedCssStyle extends IDisposable {
  glyphMarginClassName?: string;
  className?: string;
  inlineClassName?: string;
  afterContentClassName?: string;
  beforeContentClassName?: string;
  overviewRulerColor?: string | IThemeColor;
}

export const IEditorDecorationCollectionService = Symbol('IEditorDecorationCollectionService');

export class EditorSelectionChangeEvent extends BasicEvent<IEditorSelectionChangeEventPayload> {}

export interface IEditorSelectionChangeEventPayload {

  group: IEditorGroup;

  resource: IResource;

  selections: ISelection[];

  source: string | undefined;

  editorUri: URI;
}

export class EditorVisibleChangeEvent extends BasicEvent<IEditorVisibleChangeEventPayload> {}

export interface IEditorVisibleChangeEventPayload {

  group: IEditorGroup;

  resource: IResource;

  visibleRanges: IRange[];
}

export class EditorConfigurationChangedEvent extends BasicEvent<IEditorConfigurationChangedEventPayload> {}

export interface IEditorConfigurationChangedEventPayload {

  group: IEditorGroup;

  resource: IResource;
}

export class EditorGroupIndexChangedEvent extends BasicEvent<IEditorGroupIndexChangeEventPayload> {}

export interface IEditorGroupIndexChangeEventPayload {

  group: IEditorGroup;

  index: number;
}

export class EditorGroupsResetSizeEvent extends BasicEvent<void> {}

export interface IEditorDecorationProvider {

  // 装饰要命中的uri scheme, 不传会命中所有scheme
  schemes?: string[];

  // 同一个key的decoration会覆盖
  key: string;

  // 提供decoration
  provideEditorDecoration(uri: URI): MaybePromise<monaco.editor.IModelDeltaDecoration[] | undefined>;

  // decorationChange事件
  onDidDecorationChange: Event<URI>;

}

export class EditorDecorationProviderRegistrationEvent extends BasicEvent<IEditorDecorationProvider> {}

export class EditorDecorationChangeEvent extends BasicEvent<{uri: URI, key: string}> {}

export class EditorDecorationTypeRemovedEvent extends BasicEvent<string> {}

export interface IEditorActionRegistry {
  /**
   * 请不要再使用,暂时除了tip相关和isVisible仍然兼容
   * @deprecated
   * @param
   */
  registerEditorAction(action: IEditorActionItem): IDisposable;

  getMenu(group: IEditorGroup): IMenu;
}

export interface IEditorActionItem {
  title: string;
  iconClass: string;
  tip?: string;
  tipWhen?: string;
  tipClass?: string;
  /**
   * @deprecated 现在无效
   */
  isVisible?: (resource: MaybeNull<IResource>, editorGroup: IEditorGroup) => boolean;
  /**
   * @deprecated 现在会自动转为临时command
   */
  onClick: (resource: MaybeNull<IResource>, editorGroup: IEditorGroup) => void;
  when?: string; // 使用contextkey
}

export interface IVisibleAction {
  item: IEditorActionItem;
  tipVisible: boolean;
  closeTip(): void;
}

export const IEditorActionRegistry = Symbol('IEditorActionRegistry');

export interface ICompareService {

  /**
   * 在编辑器中compare两个文件
   */
  compare(original: URI, modified: URI, name: string): Promise<CompareResult>;

}

export const ICompareService = Symbol('ICompareService');

export enum CompareResult {
  revert = 'revert', // original -> modified
  accept = 'accept', // modified -> original
  cancel = 'cancel',
}

export interface IBreadCrumbService {

  registerBreadCrumbProvider(provider: IBreadCrumbProvider): IDisposable;

  getBreadCrumbs(uri: URI, editor?: MaybeNull<IEditor>): IBreadCrumbPart[] | undefined;

  disposeCrumb(uri: URI): void;

}

export const IBreadCrumbService = Symbol('IBreadScrumbService');

export interface IBreadCrumbProvider {

  handlesUri(URI: URI): boolean;

  provideBreadCrumbForUri(uri: URI, editor?: MaybeNull<IEditor>): IBreadCrumbPart[];

  onDidUpdateBreadCrumb: Event<URI>;

}

export interface IBreadCrumbPart {

  name: string;

  icon?: string;

  getSiblings?(): MaybePromise<{parts: IBreadCrumbPart[], currentIndex: number}>;

  // getChildren和onClick只能存在一个，如果同时存在,getChildren生效
  getChildren?(): MaybePromise<IBreadCrumbPart[]>;

  onClick?(): void;

}

export const IEditorFeatureRegistry = Symbol('IEditorFeatureRegistry');

export interface IEditorFeatureRegistry {

  /**
   * 注册一个用来加强编辑器能力的Contribution
   * @param contribution
   */
  registerEditorFeatureContribution(contribution: IEditorFeatureContribution): IDisposable;

}

export interface IEditorFeatureContribution {

  /**
   * 当一个编辑器被创建时，会调用这个API，返回的Disposable会在编辑器被销毁时执行
   * @param editor
   */
  contribute(editor: IEditor): IDisposable;

}

export class ResourceOpenTypeChangedEvent extends BasicEvent<URI> {}
