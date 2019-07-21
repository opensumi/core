import { IResource, ResourceService, IEditorGroup, IDecorationRenderOptions, ITextEditorDecorationType, TrackedRangeStickiness, OverviewRulerLane, UriComponents, IEditorOpenType } from '../common';
import { MaybePromise, IDisposable, BasicEvent, IRange, MaybeNull, ISelection } from '@ali/ide-core-browser';
import { IThemeColor } from '@ali/ide-theme/lib/common/color';

export type ReactEditorComponent<MetaData = any> = React.ComponentClass<{resource: IResource<MetaData>}> | React.FunctionComponent<{resource: IResource<MetaData>}>;

export interface IEditorComponent<MetaData = any> {

  // 唯一id
  uid: string;

  // component 对象
  component: ReactEditorComponent<MetaData>;

  // 要被handle的scheme
  scheme: string;

  // 是否绘制多个, 默认为
  multiple?: boolean;
}

export abstract class EditorComponentRegistry {

  abstract registerEditorComponent<T>(component: IEditorComponent<T>): IDisposable;

  abstract registerEditorComponentResolver<T>(scheme: string, resolver: IEditorComponentResolver<T>): IDisposable;

  abstract resolveEditorComponent(resource: IResource): Promise<IEditorOpenType[]>;

  abstract getEditorComponent(id: string): IEditorComponent | null;
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

  registerComponent?(editorComponentRegistry: EditorComponentRegistry): void;

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
