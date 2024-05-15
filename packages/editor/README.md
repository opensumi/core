---
id: editor
title: 编辑器模块
---

# 编辑器结构和概念

#### 打开一个 tab 的过程

![](https://cdn.nlark.com/yuque/0/2021/png/201640/1617938693844-e954f3ea-2888-48e2-8527-683603b15b39.png)

1. 在整个 IDE 全局中，拥有一个唯一的 WorkbenchEditorService 实例，它是全局的编辑器管理服务。我们在打开一个编辑器时，首先要调用它的 open 方法，传入一个对应的 uri，如 file://path/to/fileToOpen.ts
2. 为了打开这个 uri， 我们需要将其转换为一个在编辑器中可打开的 IResource, 它会拥有更多必要的对编辑器的信息。 这些信息由提前注册的 `IResourceProvider` 提供。

```typescript
/**
 * Resource
 * 一个资源代表了一个能够在编辑器区域被打开的东西
 */
export interface IResource<MetaData = any> {
  /**
   * 是否允许刷新后恢复
   */
  supportsRevive?: boolean;

  // 资源名称
  name: string;
  // 资源URI
  uri: URI;
  // 资源icon的class
  icon: string;
  // 资源的额外信息
  metadata?: MetaData;
  // 资源已被删除
  deleted?: any;
}
```

3. 获得 IResource 之后，就可以在 tab 上创建新 tab， 展示对应的名称和 icon 了。
4. 为了能在编辑器中展示内容，还需要知道如何把这个 IResource 打开，编辑器模块支持一个资源拥有多种打开方式，如 md 文件拥有代码和实时预览的方式。一个打开方式可以是代码编辑器、diff 编辑器，或者是一个编辑器富组件（React 组件）。这些打开方式和富组件都需要提前在 `EditorComponentRegistry` 中进行注册

```typescript
// 定义一个resource如何被打开
export interface IEditorOpenType {
  type: 'code' | 'diff' | 'component';

  componentId?: string;

  title?: string;

  readonly?: boolean;

  // 默认0， 大的排在前面
  weight?: number;
}
```

5. 获得对应的打开方式后，根据用户选择的类型将对应的内容展现在编辑器的主体中，这样就完成了一个 tab 的打开过程。

# 贡献点

## Contribution Providers

模块定义的用于其他模块贡献的贡献点。

### BrowserEditorContribution

所有向编辑器模块贡献功能的贡献点统一使用 `BrowserEditorContribution`

**registerResource**

用来在合适的时机向 `ResourceService` 注册可以在编辑器内打开的资源。

为了让一个 uri 能够在编辑器中被打开，首先需要向 `ResourceService` 注册一个用于解析 uri 至一个编辑器资源（`IResource`) 的 `IResourceProvider`。它的主要职责是在这个 uri 在编辑器标签 Tab 上显示时提供它的名称、图标、是否被编辑等状态，以及相应这个 tab 被关闭时的回调等等。

**registerEditorComponent**

用来在合适的时机向 `EditorComponentRegistry` 注册编辑器组件、打开方式等功能。

一个 uri 对应的编辑器资源 (`IResource`) 需要能够在编辑器中展示，还需要为它注册对应的一个或者多个打开方式，以及对应打开方式使用的 React 组件。

**onDidRestoreState**

当进入 IDE 时，编辑器会尝试恢复上一次打开的编辑器组和组内打开的文件完成后会执行 onDidRestoreState 这个 hook

**registerEditorFeature**

用来在合适的时机向 `IEditorFeatureRegistry` 注册 `EditorFeatureContribution`，以通过这种方式增强 monaco 编辑器的能力。

#### Example

示例 1: 为 example_scheme://exampleTitle 这样的 Uri 注册一个编辑器组件，使得它能在编辑器内被打开。

```tsx
const ExampleEditorComponent = () => {
  return <div>示例组件内容</div>;
};

@Domain(BrowserEditorContribution)
export class ExampleEditorContribution implements BrowserEditorContribution {
  registerResource(resourceService: ResourceService): void {
    // 注册example_scheme 可以在编辑器打开，并且设定对应的tab icon 和 名字
    resourceService.registerResourceProvider({
      scheme: 'example_scheme',
      provideResource: async (uri: URI): Promise<IResource<IWelcomeMetaData>> => {
        return {
          uri,
          name: '示例编辑器组件',
          icon: 'example-icon-class',
        };
      },
    });
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    // 将组件进行注册
    registry.registerEditorComponent({
      component: ExampleEditorComponent,
      uid: 'example_scheme_component',
      scheme: 'example_scheme',
    });

    // 将这个组件设置为这个 example_scheme 的 resource 的默认打开方式
    registry.registerEditorComponentResolver('example_scheme', (resource, results) => {
      results.push([
        {
          type: 'component',
          componentId: 'example_scheme_component',
        },
      ]);
    });
  }
}
```

示例 2： 为 monaco 编辑器提供额外的能力

```ts

@Domain(BrowserEditorContribution)
export class ExampleEditorContribution implements BrowserEditorContribution {

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        // 在编辑器被创建时，会调用 contribute 这个函数，此时可以添加功能
        // 需要返回一个 disposer，在编辑器实例被销毁的时候调用
        return editor.monacoEditor.onDidChangeModel((e) => {
          console.log(e.oldModelUrl?.toString());
        })
      },
  }
}

```

## Contributions

模块注册的贡献点。

### Command

- `file.new.untitled`: 在编辑器创建一个新文件
- `editor.undo`: 撤销 (编辑器时)
- `editor.redo`: 重做 (编辑器时)
- `editor.componentUndo`: 撤销 (富组件时)
- `editor.componentRedo`: 撤销 (富组件时)
- `editor.selectAll`: 全选
- `editor.openUri`: 打开一个 uri
- `editor.openUris`: 打开多个 uri
- `editor.saveUri`: 保存某个 uri 指定的文件
- `editor.compare`: 将两个 uri 进行比较
- `editor.close`: 关闭当前打开的 tab
- `editor.closeAllInGroup`: 关闭一组 tab
- `editor.closeOtherEditorsInGroup`： 在一组 tab 中关闭除目标以外的其他 tab
- `editor.closeAll`: 关闭全部 tab
- `editor.closeSaved`: 关闭已保存的 tab
- `editor.closeToRight`: 关闭右侧的 tab
- `editor.getCurrent`: 获取当前的 tab 的 uri
- `editor.getCurrentResource`: 获取当前的 tab 的 resource
- `editor.splitToLeft`: 向左拆分编辑器组
- `editor.splitToRight`: 向右拆分编辑器组
- `editor.splitToTop`: 向上拆分编辑器组
- `editor.splitToBottom`: 向上拆分编辑器组
- `editor.changeLanguage`: 修改当前编辑器的语言
- `editor.changeEol`: 修改当前编辑器的 eol
- `editor.navigateLeft`: 将光标移到到左边的编辑器组
- `editor.navigateRight`: 将光标移到到右边的编辑器组
- `editor.navigateUp`: 将光标移到到上边的编辑器组
- `editor.navigateDown`: 将光标移到到下边的编辑器组
- `editor.navigatePrevious`: 将光标移到到上一个编辑器组
- `editor.navigateNext`: 将光标移到到下一个编辑器组
- `editor.goToGroup`: 将光标移到指定的编辑器组
- `editor.previous`: 移动到前一个 tab （如果是组里面第一个，则会移动到上一组）
- `editor.next`: 移动到后一个 tab （如果是组里面最后一个，则会移动到下一组）
- `editor.previousInGroup`: 移动到当前编辑器组内前一个 tab
- `editor.nextInGroup`: 移动到当前编辑器组内后一个 tab
- `editor.closeOtherGroup`: 关闭其他编辑器组
- `editor.openEditorAtIndex`: 打开当前编辑器组第 x 个 tab 页
- `editor.evenEditorGroups`: 重置编辑器组大小
- `editor.document.revert`: 还原当前 tab 的文档
- `editor.revertAndClose`: 还原当前 tab 的文档，并关闭当前 tab
- `editor.goForward`: 前进到下一个编辑器光标的历史位置
- `editor.goBack`: 回到上一个编辑器光标的历史位置
- `editor.pinCurrent`: 将当前 tab 固定（取消 preview 模式）
- `editor.copyCurrentPath`: 复制当前 tab 的路径 （文件路径）
- `editor.moveGroup`: 将当前的 tab 移到另外一个编辑器组
- `editor.reopenClosed`: 重新打开刚刚关闭的 tab
- `editor.focus`: 编辑器获取焦点
- `editor.autoSave`: 切换自动保存

### Preference

editor 模块中将所有 monaco 的 options 变成了对应含有 `editor.` 前缀的 preference 详见 src/browser/preference/schema.ts

其他的 preferences:

- `editor.readonlyFiles`: 只读的文件列表
- `editor.previewMode`: 是否开启预览模式
- `editor.tokenColorCustomizations`: 自定义 token 颜色的配置
- `editor.askIfDiff`: 保存文件时，如果磁盘文件较新，是否弹出提示
- `editor.showActionWhenGroupEmpty`: 在编辑器组没有 tab 时，是否显示右上角的 editor/title 菜单
- `editor.autoSave`: 自动保存的模式
- `editor.autoSaveDelay`: 当自动保存是 afterDelay 时，保存的延时时长
- `editor.preferredFormatter`: 针对各个语言的格式化方式选择的配置
- `editor.forceReadOnly`: 是否强制所有编辑器变成 readOnly
- `editor.languageFeatureEnabledMaxSize`: 会启用 languageFeature 的最大文件尺寸
- `editor.docExtHostSyncMaxSize`: 会同步到 extHost 的最大文件尺寸
- `editor.formatOnSave`: 是否在保存时自动格式化
- `editor.formatOnSaveTimeout`: 保存时自动格式化的最大执行时间
- `editor.largeFile`: 对于 '大文件' 的大小定义， 单位 B
- `editor.modelDisposeTime`: 编辑器 tab 关闭后， 没有被引用的文档会被 dispose 的延时

### KeyBinding

- `ctrlcmd+s`: 保存文件
- `ctrlcmd+w` **Electron**: 关闭当前 tab
- `alt+shift+w` **Web**: 关闭当前 tab
- `alt+cmd+left` **Electron**: 前一个 tab
- `ctrlcmd+pageup` **Electron**: 前一个 tab
- `ctrl+shift+tab` **Electron**: 前一个 tab
- `ctrlcmd+shift+[` **Electron** **Mac**: 前一个 tab
- `ctrlcmd+ctrl+left` **Web**: 前一个 tab
- `alt+pageup` **Web**: 前一个 tab
- `alt+cmd+right` **Electron**: 后一个 tab
- `ctrlcmd+pagedown` **Electron**: 后一个 tab
- `ctrl+tab` **Electron**: 后一个 tab
- `ctrlcmd+shift+]` **Electron** **Mac**: 后一个 tab
- `ctrlcmd+ctrl+right` **Web**: 后一个 tab
- `alt+pagedown` **Web**: 后一个 tab
- `alt+right` **Windows** : 下一个光标位置
- `ctrl+shift+-` **Mac** : 下一个光标位置
- `alt+left` **Windows** : 上一个光标位置
- `ctrl+-` **Mac** : 上一个光标位置
- `ctrlcmd+k m`: 修改当前打开的文件的语言
- `ctrlcmd+\`: 向右拆分
- `ctrlcmd+k ctrlcmd+right`: 下一个编辑器组
- `ctrlcmd+k ctrlcmd+left`: 上一个编辑器组
- `alt+ctrlcmd+s`：保存全部文件
- `ctrlcmd+k w`: 关闭全部
- `ctrlcmd+k enter`: 让当前 tab 退出 preview 状态
- `ctrlcmd+k p`: 复制当前 tab 路径
- `ctrlcmd+shift+t` **Electron**: 重新打开已关闭的文件
- `alt+shift+t` **Web**: 重新打开已关闭的文件
- `ctrlcmd+n` **Electron**: 创建一个新文件 tab
- `alt+n` **Web**: 创建一个新文件 tab
- `ctrlcmd+t` **Electron**: 搜索 workspace symbol
- `ctrlcmd+o` **Web**: 搜索 workspace symbol
- `ctrlcmd+1` : 去到第 1 个编辑器组
- `ctrlcmd+2` : 去到第 2 个编辑器组
- `ctrlcmd+3` : 去到第 3 个编辑器组
- `ctrlcmd+4` : 去到第 4 个编辑器组
- `ctrlcmd+5` : 去到第 5 个编辑器组
- `ctrlcmd+6` : 去到第 6 个编辑器组
- `ctrlcmd+7` : 去到第 7 个编辑器组
- `ctrlcmd+8` : 去到第 8 个编辑器组
- `ctrlcmd+9` : 去到第 9 个编辑器组
- `ctrlcmd+k up`: 将当前 tab 移动到上方编辑器组
- `ctrlcmd+k left`: 将当前 tab 移动到左方编辑器组
- `ctrlcmd+k right`: 将当前 tab 移动到右方编辑器组
- `ctrlcmd+k down`: 将当前 tab 移动到下方编辑器组

### Menu

#### MenuIds

- `editor/title`: 每组编辑器右上角的动作按钮
- `editor/title/context`: 在 tab 上右键出现的菜单
- `editor/context`: 在编辑器内 (必须是 monaco 编辑器内) 右键出现的菜单

# 类

### WorkbenchEditorService

外部模块调用编辑器主要通过这个 class 进行对应的操作

```typescript
export abstract class WorkbenchEditorService {
  /**
   * 当前 resource 发生变更
   */
  onActiveResourceChange: Event<MaybeNull<IResource>>;

  /**
   * 当前编辑器内鼠标
   */
  onCursorChange: Event<CursorStatus>;

  /**
   * 编辑器组发生改变时的事件
   */
  onDidEditorGroupsChanged: Event<void>;

  /**
   * 当前 editorGroup 发生改变的事件
   */
  onDidCurrentEditorGroupChanged: Event<IEditorGroup>;

  /**
   * 所有的编辑器组
   */
  editorGroups: IEditorGroup[];

  /**
   *
   */
  sortedEditorGroups: IEditorGroup[];

  /**
   * 当前的编辑器对象
   */
  currentEditor: IEditor | null;

  /**
   * 当前焦点的编辑器资源
   */
  currentResource: MaybeNull<IResource>;

  /**
   * 当前的编辑器组
   */
  currentEditorGroup: IEditorGroup;

  /**
   * 关闭全部
   * @param uri 只关闭指定的 uri
   * @param force 不进行关闭前提醒（不执行 shouldCloseResource)
   */
  abstract async closeAll(uri?: URI, force?: boolean): Promise<void>;

  /**
   * 打开指定的 uri
   * @param uri
   * @param options 打开的选项
   */
  abstract async open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;

  /**
   * 打开多个 uri
   * @param uri
   */
  abstract async openUris(uri: URI[]): Promise<void>;

  /**
   * 保存全部
   * @param includeUntitled 是否对新文件进行保存询问, 默认false
   */
  abstract saveAll(includeUntitled?: boolean): Promise<void>;

  /**
   * 关闭指定的 uri， 等同于 closeAll 带 uri 参数
   * @param uri
   * @param force
   */
  abstract async close(uri: any, force?: boolean): Promise<void>;

  /**
   * 获得当前打开的 uri
   */
  abstract getAllOpenedUris(): URI[];

  /**
   * 获得当前打开的文档资源
   */
  abstract getAllOpenedDocuments(): Promise<IEditorDocumentModel[]>;

  /**
   * 创建一个带待存的资源
   * @param options
   */
  abstract createUntitledResource(options?: IUntitledOptions): Promise<IOpenResourceResult>;
}
```

### IEditor

monaco 编辑器的包裹概念

```typescript
/**
 * 一个IEditor代表了一个最小的编辑器单元，可以是CodeEditor中的一个，也可以是DiffEditor中的两个
 */
export interface IEditor {
  /**
   * 获得当前编辑器
   */
  getId(): string;

  /**
   * 获得编辑器的类型
   */
  getType(): EditorType;

  /**
   * editor中打开的documentModel
   */

  currentDocumentModel: IEditorDocumentModel | null;

  /**
   * 当前的uri
   */
  currentUri: URI | null;

  /**
   * 插入代码片段
   * @param template
   * @param ranges
   * @param opts
   */
  insertSnippet(template: string, ranges: readonly IRange[], opts: IUndoStopOptions);

  /**
   * 应用装饰器
   * @param key
   * @param options
   */
  applyDecoration(key: string, options: IDecorationApplyOptions[]);

  getSelections(): ISelection[] | null;
  onSelectionsChanged: Event<{ selections: ISelection[]; source: string }>;

  onVisibleRangesChanged: Event<IRange[]>;

  onConfigurationChanged: Event<void>;

  setSelections(selection: IRange[] | ISelection[]);

  setSelection(selection: IRange | ISelection);

  updateOptions(editorOptions?: IEditorOptions, modelOptions?: ITextModelUpdateOptions);

  save(): Promise<void>;

  /**
   * 获得包裹的 monaco 编辑器
   */
  monacoEditor: editor.ICodeEditor;

  onDispose: Event<void>;
}
```

### IEditorGroup

```typescript
/**
 * 编辑器组
 * 是一组tab和一个展示编辑器或者编辑器富组件的单元，主要用来管理 tab 的生命周期，以及控制编辑器主体的展示。
 * 一个 workbenchEditorService 会拥有多个（至少一个）编辑器组，它会在类似 “向右拆分” 这样的功能被使用时创建，在该组tab完全关闭时销毁。
 */
export interface IEditorGroup {
  /**
   * 当前 editorGroup 在 workbenchEditorService.sortedEditorGroups 中的 index
   */
  index: number;

  /**
   * 当前 editorGroup 的名称，唯一，可视作 id
   */
  name: string;

  /**
   * 每个编辑器组拥有一个代码编辑器和一个diff编辑器实例
   * 当前group的代码编辑器
   */
  codeEditor: ICodeEditor;

  /**
   * 当前group的diff编辑器实例
   */
  diffEditor: IDiffEditor;

  /**
   * 当前的编辑器 （如果当前是富组件，则返回 null)
   */
  currentEditor: IEditor | null;

  /**
   * 和 currentEditor 不同，对于 DiffEditor 来说会取到上一次 focus 的 Editor
   */
  currentFocusedEditor: IEditor | undefined;

  /**
   * 所有当前编辑器租的 tab 的资源
   */
  resources: IResource[];

  /**
   * 当前的 tab 对应的资源
   */
  currentResource: MaybeNull<IResource>;

  /**
   * 当前的打开方式
   */
  currentOpenType: MaybeNull<IEditorOpenType>;

  onDidEditorGroupContentLoading: Event<IResource>;

  resourceStatus: Map<IResource, Promise<void>>;

  open(uri: URI, options?: IResourceOpenOptions): Promise<IOpenResourceResult>;

  /**
   * 取消指定 uri 的 tab 的 preview模式（斜体模式），如果它是的话
   * @param uri
   */
  pin(uri: URI): Promise<void>;

  /**
   * 关闭指定的 uri 的 tab， 如果存在的话
   * @param uri
   */
  close(uri: URI): Promise<void>;

  getState(): IEditorGroupState;

  restoreState(IEditorGroupState): Promise<void>;

  saveAll(): Promise<void>;

  closeAll(): Promise<void>;

  /**
   * 保存当前的 tab 的文件 (如果它能被保存的话)
   */
  saveCurrent(reason?: SaveReason): Promise<void>;

  /**
   * 保存某个 resource
   * @param resource
   * @param reason
   */
  saveResource(resource: IResource, reason: SaveReason): Promise<void>;
}
```
