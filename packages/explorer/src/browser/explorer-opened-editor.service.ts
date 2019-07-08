import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { URI } from '@ali/ide-core-browser';
import { OpenedEditorTreeDataProvider } from '@ali/ide-opened-editor/lib/browser/opened-editor.service';

@Injectable()
export class ExplorerOpenedEditorService {
  @Autowired(OpenedEditorTreeDataProvider)
  openEditorTreeDataProvider: OpenedEditorTreeDataProvider;

  @observable
  dataProvider;

}
