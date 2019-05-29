import { WorkbenchEditorService, EditorCollectionService, IEditor, IResource, ResourceService } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Optinal } from '@ali/common-di';
import { observable, computed } from 'mobx';
import { CommandService, URI, getLogger } from '@ali/ide-core-common';
import { EditorComponentRegistry, IEditorPayload, IEditorComponent } from './types';
import { FileSystemEditorContribution } from './file';

const CODE_EDITOR_SUFFIX = '-code';
const MAIN_EDITOR_GROUP_NAME = 'main';

@Injectable()
export class WorkbenchEditorServiceImpl implements WorkbenchEditorService {

  @observable.shallow
  editorGroups: EditorGroup[] = [];

  @Autowired(INJECTOR_TOKEN)
  private injector!: Injector;

  @Autowired(CommandService)
  private commands: CommandService;

  private _currentEditor: IEditor;

  private _initialize!: Promise<void>;

  constructor() {
    this.initialize();

  }

  async createMainEditorGroup(): Promise<void> {
    const injector = this.injector;
    this.editorGroups.push(injector.get(EditorGroup, [MAIN_EDITOR_GROUP_NAME]));
  }

  private initialize() {
    if (!this._initialize) {
      this._initialize = this.createMainEditorGroup();
    }
    return this._initialize;
  }

  public get currentEditor() {
    return this.editorGroups[0].codeEditor;
  }

  async open(uri: URI) {
    await this.initialize();
    return this.editorGroups[0].open(uri);
  }

}

/**
 * Editor Group是一个可视的编辑区域
 * 它由tab，editor，diffeditor，富组件container组成
 */
@Injectable({ mutiple: true })
export class EditorGroup {

  @Autowired()
  collectionService!: EditorCollectionService;

  @Autowired()
  resourceService: ResourceService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  codeEditor!: IEditor;

  /**
   * 当前打开的所有resource
   */
  @observable.shallow resources: IResource[] = [];

  /**
   * 当前resource的打开方式
   */
  @observable.shallow resourcesOpenState = new Map<URI, IEditorPayload>();

  @observable.ref availablePayloads: IEditorPayload[] = [];

  @observable.ref currentPayload: IEditorPayload;

  @observable.shallow activeComponents = new Map<IEditorComponent, IResource[]>();

  @Autowired()
  fileSystemEditorContribution: FileSystemEditorContribution;

  constructor(@Optinal(Symbol()) public readonly name: string) {

    // TODO delete this
    this.fileSystemEditorContribution.registerComponent(this.editorComponentRegistry);
    this.fileSystemEditorContribution.registerResource(this.resourceService);
  }

  async createEditor(dom: HTMLElement) {
    this.codeEditor = await this.collectionService.createEditor(this.name + CODE_EDITOR_SUFFIX, dom);
    this.codeEditor.layout();
  }

  async open(uri: URI): Promise<void> {
    const result = await this.resolvePayload(uri);
    if (result) {
      const { activePayload, payloads } = result;

      if (activePayload.type === 'code') {
        this.currentPayload = activePayload;
        this.codeEditor.open(this.currentPayload.resource.uri);
      } else if (activePayload.type === 'component') {
        const component = this.editorComponentRegistry.getEditorComponent(activePayload.componentId as string);
        if (!component) {
          throw new Error('Cannot find Editor Component with id: ' + activePayload.componentId);
        } else {
          if (!!component.multiple) {
            const openedResources = this.activeComponents.get(component) || [];
            const index = openedResources.findIndex((r) => r.uri.toString() === activePayload.resource.uri.toString());
            if (index === -1 ) {
              openedResources.push(activePayload.resource);
            }
            this.activeComponents.set(component, openedResources);
          } else {
            this.activeComponents.set(component, [activePayload.resource]);
          }
          this.currentPayload = activePayload;
        }
      }
    }
  }

  private async resolvePayload(uri: URI): Promise<{activePayload: IEditorPayload, payloads: IEditorPayload[] } | null> {
    // TODO 可能的优化：如果不追求每次都能正确resolve最新的结果，可以考虑缓存已打开的resource的结果
    // 目前是强制每次都更新
    // 需要验证是否存在性能问题或者其他坑
    if (this.currentResource && this.currentResource.uri === uri) {
      return null; // 就是当前打开的resource
    } else {
      const resource = await this.resourceService.getResource(uri);
      if (!resource) {
        throw new Error('This uri cannot be opened!: ' + uri);
      }
      const payloads = await this.editorComponentRegistry.resolveEditorComponent(resource);
      const activePayload = findSuitablePayload(payloads, this.resourcesOpenState.get(uri));
      const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
      if (index !== -1) {
        // 如果已存在，更新resource
        this.resources.splice(index, 1, resource);
      } else {
        this.resources.push(resource);
      }
      return { activePayload, payloads };
    }
  }
  /**
   * 当前打开的resource
   */
  @computed
  get currentResource(): IResource | undefined {
    return this.currentPayload && this.currentPayload.resource;
  }

}

function findSuitablePayload(currentAvailable: IEditorPayload[], prev: IEditorPayload | undefined) {
  if (!prev) {
    return currentAvailable[0];
  } else {
    return currentAvailable.find((p) => {
      return payloadSimilar(p, prev);
    }) || currentAvailable[0];
  }
}

function payloadSimilar(a: IEditorPayload, b: IEditorPayload) {
  return a.type === b.type && (a.type !== 'component' || a.componentId === b.componentId);
}
