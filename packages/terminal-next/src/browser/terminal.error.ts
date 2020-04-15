import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { ITerminalErrorService, ITerminalError, ITerminalExternalService, ITerminalController } from '../common';

@Injectable()
export class TerminalErrorService implements ITerminalErrorService {
  @observable
  errors: Map<string, ITerminalError> = new Map();

  @Autowired(ITerminalExternalService)
  protected readonly service: ITerminalExternalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  constructor() {
    this.service.onError((error) => {
      this.errors.set(error.id, error);
    });
  }

  fix(clientId: string) {
    const client = this.controller.findClientFromWidgetId(clientId);
    if (client) {
      client.reset();
      client.attach().then(() => {
        if (client.ready) {
          this.errors.delete(clientId);
        }
        client.layout();
      });
    }
  }
}
