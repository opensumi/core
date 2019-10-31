import { IResource, ResourceService, IEditorGroup, IDecorationRenderOptions, ITextEditorDecorationType, TrackedRangeStickiness, OverviewRulerLane, UriComponents, IEditorOpenType, IEditor } from '../common';
import { MaybePromise, IDisposable, BasicEvent, IRange, MaybeNull, ISelection, URI, Event, IContextKeyExpr } from '@ali/ide-core-browser';
import { IThemeColor } from '@ali/ide-theme/lib/common/color';
import { IEditorDocumentModelContentRegistry } from './doc-model/types';

export type ReactEditorComponent<MetaData = any> = React.ComponentClass<{resource: IResource<MetaData>}> | React.FunctionComponent<{resource: IResource<MetaData>}>;

export interface IEditorComponent<MetaData = any> {

  // 唯一id
  uid: string;

  // component 对象
  component: ReactEditorComponent<MetaData>;

  // 要被handle的scheme
  scheme: string;

  // 渲染模式 默认为 ONE_PER_GROUP
  renderMode?: EditorComponentRenderMode;

}

export enum EditorComponentRenderMode {
  ONE_PER_RESOURCE, // 每个resource渲染一个新的
  ONE_PER_GROUP, // 每个Group最多存在一个新的
  ONE_PER_WORKBENCH, // 整个IDE只有一个, 视图会被重用
}

export abstract class EditorComponentRegistry {

  abstract registerEditorComponent<T>(component: IEditorComponent<T>): IDisposable;

  abstract registerEditorComponentResolver<T>(scheme: string, resolver: IEditorComponentResolver<T>): IDisposable;

  abstract resolveEditorComponent(resource: IResource): Promise<IEditorOpenType[]>;

  abstract getEditorComponent(id: string): IEditorComponent | null;

  abstract clearPerWorkbenchComponentCache(componentId: string): void;
}

/**
 * 打开资源的处理委派函数
 * @param resource 要打开的资源
 * @param results 在执行此责任委派函数前，已经支持的打开方式
 * @param resolve 调用这个函数，传入结果可结束责任链直接返回支持的打开方式
 */
export type IEditorComponentResolver<MetaData = any> =
  (resource: IResource<MetaData>, results: IEditorOpenType[], resolve?: (results: IEditorOpenType[]) => void) => MaybePromise<void>;

export const BrowserEditorContribution = Symbol('BrowserEditorContribution');

export interface BrowserEditorContribution {

  registerResource?(resourceService: ResourceService): void;

  registerEditorComponent?(editorComponentRegistry: EditorComponentRegistry): void;

  registerEditorDocumentModelContentProvider?(registry: IEditorDocumentModelContentRegistry): void;

  registerEditorActions?(editorActionRegistry: IEditorActionRegistry): void;

  onDidRestoreState?(): void;
}

export interface IGridResizeEventPayload {
  gridId: string;
}

export class GridResizeEvent extends BasicEvent<IGridResizeEventPayload> {}

export enum DragOverPosition {
  LEFT = 'left',
  RIGHT = 'right',
  TOP = 'top',
  BOTTOM = 'bottom',
  CENTER= 'center',
}

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
  className?: string;
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

export interface IEditorActionRegistry {
  registerEditorAction(action: IEditorActionItem): IDisposable;
  getActions(editorGroup: IEditorGroup): IEditorActionItem[];
}

export interface IEditorActionItem {
  title: string;
  iconClass: string;
  isVisible?: (resource: MaybeNull<IResource>, editorGroup: IEditorGroup) => boolean;
  onClick: (resource: MaybeNull<IResource>) => void;
  when?: string; // 使用contextkey
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
