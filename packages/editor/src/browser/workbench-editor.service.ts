import { WorkbenchEditorService, EditorCollectionService, IEditor, IResource } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Inject } from '@ali/common-di';
import { observable } from 'mobx';
import { CommandService, URI } from '@ali/ide-core-common';

const tempToken = Symbol();
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
    injector.addProviders({ token: tempToken, useValue: '11' });

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

  async openResource(resource: IResource) {
    await this.initialize();
    return this.currentEditor.open(resource.uri);
  }

}

@Injectable({ multiple: true })
export class EditorGroup {

  @Autowired()
  collectionService!: EditorCollectionService;

  codeEditor!: IEditor;

  constructor(@Inject(tempToken) public readonly name: string) {

  }

  async createEditor(dom: HTMLElement) {
    this.codeEditor = await this.collectionService.createEditor(this.name + CODE_EDITOR_SUFFIX, dom);
    this.codeEditor.layout();
  }

}
