import { IResource, ResourceService } from '../common';
import { MaybePromise, IDisposable } from '@ali/ide-core-browser';

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

// 定义一个resource如何被打开
export interface IEditorOpenType {

  type: 'code' | 'diff' | 'component';

  componentId?: string;

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
