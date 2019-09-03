import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';

@Injectable()
export class DebugVariableService {
  @observable
  scopes: any[] = [];

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  constructor() {
    this.init();
  }

  init() {
    this.viewModel.onDidChange(async () => {
      await this.updateModel();
    });
  }

  @action
  async updateModel() {
    const { currentSession } = this.viewModel;
    this.scopes = currentSession ? await currentSession.getScopes() : [];
  }
}
