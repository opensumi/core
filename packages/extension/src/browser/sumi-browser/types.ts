import { ProxyIdentifier } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { IDisposable, Uri } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { EditorComponentRenderMode } from '@opensumi/ide-editor/lib/browser';
import { ToolBarPosition } from '@opensumi/ide-toolbar/lib/browser';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { IExtension } from '../..';

export interface ISumiBrowserContributions {
  [containerId: string]:
    | {
        type?: 'replace' | 'add';
        view: IEditorViewContribution[] | ITabBarViewContribution[];
      }
    | undefined;
  left?: {
    type: 'replace' | 'add';
    view: ITabBarViewContribution[];
  };
  right?: {
    type: 'replace' | 'add';
    view: ITabBarViewContribution[];
  };
  bottom?: {
    type: 'replace' | 'add';
    view: ITabBarViewContribution[];
  };
  editor?: {
    view: IEditorViewContribution[];
  };
  editorSide?: {
    view: IEditorSideViewContribution[];
  };
  toolBar?: {
    position?: ToolBarPosition; // @deprecated
    view: IToolBarViewContribution[];
  };
}

export interface IToolBarViewContribution {
  /**
   * id
   */
  id: string;
  /**
   * ToolBar 组件主体
   */
  component: React.FC;

  /**
   * 位置
   */
  position: ToolBarPosition;

  order?: number;

  weight?: number;

  description?: string;
}

export interface ITabBarViewContribution {
  /**
   * id
   */
  id: string;
  /**
   * Tabbar组件主体
   */
  component: React.FC;
  /**
   * 自定义titleComponent组件，仅支持插件注册container
   */
  titleComponent?: React.FC;

  /**
   * 内置icon名称
   */
  icon?: string;

  /**
   * 相对于插件路径的icon地址
   */
  iconPath?: string;

  /**
   * 用于激活的快捷键
   */
  keyBinding?: string;

  /**
   * 名称
   */
  title: string;

  /**
   * 自定义标题组件id
   */
  titleComponentId?: string;

  /**
   * 排序权重
   */
  priority?: number;

  /**
   * 禁止面板的resize功能
   */
  noResize?: boolean;

  /**
   * 是否全部展开
   */
  expanded?: boolean;
}

export interface IEditorViewContribution {
  /**
   * id
   */
  id: string;

  /**
   * 适配的scheme, 如果不填，默认为file协议
   */
  scheme?: string;

  /**
   * editor组件主体
   */
  component: React.FC;

  /**
   * 渲染方式
   */
  renderMode?: EditorComponentRenderMode;

  /**
   * 仅作用于file协议
   * 要处理的文件的后缀
   */
  fileExt?: string[];

  /**
   * 仅作用于file协议
   * 判断一个path是否要被处理
   * @deprecated
   */
  shouldPreview?: (path: Path) => boolean;

  /**
   * 判断一个uri是否要被处理(传入参数为vscode uri)
   * 如果不存在handles方法，则默认显示（file协议还要过shouldPreview和fileExt)
   */
  handles?: (uri: Uri) => boolean;

  /**
   * 如果这个资源有多个打开方式，这个会作为打开方式名称
   */
  title?: string;

  /**
   * 排序权重， 默认为10
   */
  priority?: number;

  /**
   * Tab名称，如果需要更复杂的名称Resolve，需要在 sumi node进程中注册ResourceProvider
   */
  tabTitle?: string;

  /**
   * 相对于插件路径的icon地址
   * 如果需要更复杂的图标Resolve，需要在 sumi node进程中注册ResourceProvider
   */
  tabIconPath?: string;
}

export interface IEditorSideViewContribution {
  /**
   * id
   */
  id: string;

  /**
   * editor组件主体
   */
  component: React.FC;

  /**
   * view 放置的位置，目前只支持 bottom
   */
  side: 'bottom';
  /**
   * When条件语句 https://code.visualstudio.com/api/references/when-clause-contexts#conditional-operators
   */
  when?: string | ContextKeyExpr;
}
export interface IRunTimeParams {
  getExtensionExtendService: (
    extension: IExtension,
    componentId: string,
  ) => {
    extendProtocol: {
      getProxy: (identifier: ProxyIdentifier<any>) => {
        node: any;
        worker: any;
      };
      set: <T>(identifier: ProxyIdentifier<T>, service: T) => void;
    };
    extendService: any;
  };
}

export abstract class AbstractSumiBrowserContributionRunner {
  constructor(protected extension: IExtension, protected contribution: ISumiBrowserContributions) {}

  abstract run(param: IRunTimeParams): IDisposable;
}
