import { WorkbenchEditorService, EditorCollectionService } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Inject } from '@ali/common-di';
import { observable } from 'mobx';

const tempToken = Symbol();

@Injectable()
export class WorkbenchEditorServiceImpl implements WorkbenchEditorService {

  @observable.shallow
  editorGroups: EditorGroup[] = [];

  @Autowired(INJECTOR_TOKEN)
  private injector!: Injector;

  async createMainEditorGroup(): Promise<void> {
    const childInjector = this.injector.createChild({ token: tempToken, useValue: '11' });
    this.editorGroups.push(childInjector.get(EditorGroup, ['main']));
  }

  constructor() {
    this.createMainEditorGroup();
  }

}

@Injectable({ mutiple: true })
export class EditorGroup {

  @Autowired()
  collectionService!: EditorCollectionService;

  constructor(@Inject(tempToken) public readonly name: string) {

  }

  createEditor(dom: HTMLElement) {
    return this.collectionService.createEditor(this.name + '-code', dom);
  }

}