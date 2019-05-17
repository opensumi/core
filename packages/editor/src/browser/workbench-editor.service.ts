import { WorkbenchEditorService, EditorCollectionService, IEditor } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Inject } from '@ali/common-di';
import { observable } from 'mobx';

const tempToken = Symbol();
const CODE_EDITOR_SUFFIX = '-code';
const MAIN_EDITOR_GROUP_NAME = 'main'

@Injectable()
export class WorkbenchEditorServiceImpl implements WorkbenchEditorService {

  @observable.shallow
  editorGroups: EditorGroup[] = [];

  @Autowired(INJECTOR_TOKEN)
  private injector!: Injector;

  async createMainEditorGroup(): Promise<void> {
    const injector = this.injector;
    injector.addProviders({ token: tempToken, useValue: '11' });

    this.editorGroups.push(injector.get(EditorGroup, [MAIN_EDITOR_GROUP_NAME]));
  }

  constructor() {
    this.createMainEditorGroup();
  }

}

@Injectable({ mutiple: true })
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
