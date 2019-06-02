import { WorkbenchEditorService, EditorCollectionService, IEditor, IResource, ResourceService, IResourceOpenOptions } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Optinal } from '@ali/common-di';
import { observable, computed } from 'mobx';
import { CommandService, URI, getLogger, MaybeNull } from '@ali/ide-core-common';
import { EditorComponentRegistry, IEditorComponent, IEditorOpenType } from './types';
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

export interface IEditorCurrentState {

  currentResource: IResource;

  currentOpenType: IEditorOpenType;

}
/**
 * Editor Group是一个可视的编辑区域
 * 它由tab，editor，diffeditor，富组件container组成
 */
@Injectable({ multiple: true })
export class EditorGroup {

  @Autowired()
  collectionService!: EditorCollectionService;

  @Autowired()
  resourceService: ResourceService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  codeEditor!: IEditor;

  /**
   * 当前打开的所有resource
   */
  @observable.shallow resources: IResource[] = [];

  @observable.ref currentState: IEditorCurrentState | null = null;
  /**
   * 当前resource的打开方式
   */
  private cachedResourcesActiveOpenTypes = new Map<string, IEditorOpenType>();

  private cachedResourcesOpenTypes = new Map<string, IEditorOpenType[]>();

  @observable.ref availableOpenTypes: IEditorOpenType[] = [];

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

  async open(uri: URI, options?: IResourceOpenOptions): Promise<void> {
    if (this.currentResource && this.currentResource.uri === uri) {
      return; // 就是当前打开的resource
    }
    let resource: IResource | null | undefined = this.resources.find((r) => r.uri.toString() === uri.toString());
    if (!resource) {
      // open new resource
      resource = await this.resourceService.getResource(uri);
      if (!resource) {
        throw new Error('This uri cannot be opened!: ' + uri);
      }
      if (options && options.index !== undefined && options.index < this.resources.length) {
        this.resources.splice(options.index, 0, resource);
      } else {
        this.resources.push(resource);
      }
    }
    this.displayResourceComponent(resource);
  }

  private async displayResourceComponent(resource: IResource) {
    const result = await this.resolveOpenType(resource);
    if (result) {
      const { activeOpenType, openTypes } = result;

      if (activeOpenType.type === 'code') {
        await this.codeEditor.open(resource.uri);
      } else if (activeOpenType.type === 'component') {
        const component = this.editorComponentRegistry.getEditorComponent(activeOpenType.componentId as string);
        if (!component) {
          throw new Error('Cannot find Editor Component with id: ' + activeOpenType.componentId);
        } else {
          if (!!component.multiple) {
            const openedResources = this.activeComponents.get(component) || [];
            const index = openedResources.findIndex((r) => r.uri.toString() === resource.uri.toString());
            if (index === -1 ) {
              openedResources.push(resource);
            }
            this.activeComponents.set(component, openedResources);
          } else {
            this.activeComponents.set(component, [resource]);
          }
        }
      } else {
        return; // other type not handled
      }
      this.currentState = {
        currentResource: resource,
        currentOpenType: activeOpenType,
      };
      this.cachedResourcesActiveOpenTypes.set(resource.uri.toString(), activeOpenType);
      getLogger().log(this.resources);
    }
  }

  private async resolveOpenType(resource: IResource): Promise<{activeOpenType: IEditorOpenType, openTypes: IEditorOpenType[] } | null> {
    const openTypes = this.cachedResourcesOpenTypes.get(resource.uri.toString()) || await this.editorComponentRegistry.resolveEditorComponent(resource);
    const activeOpenType = findSuitableOpenType(openTypes, this.cachedResourcesActiveOpenTypes.get(resource.uri.toString()));
    this.cachedResourcesOpenTypes.set(resource.uri.toString(), openTypes);
    return { activeOpenType, openTypes };
  }

  public async close(uri: URI) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resource = this.resources[index];
      if (!await this.resourceService.shouldCloseResource(resource, this.workbenchEditorService.editorGroups.map((group) => group.resources))) {

      }
      if ( resource === this.currentResource) {
        if (this.resources[index - 1]) {
          this.open(this.resources[index - 1].uri);
        } else {
          this.currentState = null;
        }
      }
      this.resources.splice(index, 1);
      for (const resources of this.activeComponents.values()) {
        const i = resources.indexOf(resource);
        if ( i !== -1) {
          resources.splice(i, 1);
        }
      }
      // TODO dispose document;
    }
  }
  /**
   * 当前打开的resource
   */
  @computed
  get currentResource(): MaybeNull<IResource> {
    return this.currentState && this.currentState.currentResource;
  }

  @computed
  get currentOpenType(): MaybeNull<IEditorOpenType> {
    return this.currentState && this.currentState.currentOpenType;
  }

  /**
   * 拖拽drop方法
   */
  public dropUri(uri: URI, targetResource?: IResource) {
    if (!targetResource) {
      this.open(uri);
    } else {
      const targetIndex = this.resources.indexOf(targetResource);
      if (targetIndex === -1) {
        this.open(uri);
      } else {
        const sourceIndex = this.resources.findIndex((resource) => resource.uri.toString() === uri.toString());
        if (sourceIndex === -1) {
          this.open(uri, {
            index: targetIndex,
          });
        } else {
          // just move
          const sourceResource = this.resources[sourceIndex];
          if (sourceIndex > targetIndex) {
            this.resources.splice(sourceIndex, 1);
            this.resources.splice(targetIndex, 0, sourceResource);
            this.open(uri);
          } else if (sourceIndex < targetIndex) {
            this.resources.splice(targetIndex + 1, 0 , sourceResource);
            this.resources.splice(sourceIndex, 1);
            this.open(uri);
          }
        }
      }
    }
  }

}

function findSuitableOpenType(currentAvailable: IEditorOpenType[], prev: IEditorOpenType | undefined) {
  if (!prev) {
    return currentAvailable[0];
  } else {
    return currentAvailable.find((p) => {
      return payloadSimilar(p, prev);
    }) || currentAvailable[0];
  }
}

function payloadSimilar(a: IEditorOpenType, b: IEditorOpenType) {
  return a.type === b.type && (a.type !== 'component' || a.componentId === b.componentId);
}
