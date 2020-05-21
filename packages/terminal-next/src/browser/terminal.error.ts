import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { ITerminalErrorService, ITerminalError, ITerminalExternalService, ITerminalGroupViewService, ITerminalController, IPtyExitEvent } from '../common';

@Injectable()
export class TerminalErrorService implements ITerminalErrorService {
  @observable
  errors: Map<string, ITerminalError> = new Map();

  @Autowired(ITerminalExternalService)
  protected readonly service: ITerminalExternalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  constructor() {
    this.service.onError((error) => {
      this.errors.set(error.id, error);
    });

    this.service.onExit((event: IPtyExitEvent) => {
      try {
        const widget = this.view.getWidget(event.sessionId);
        if (!widget.reuse) {
          this.view.removeWidget(event.sessionId);
        }
      } catch { /** nothing */ }
    });
  }

  fix(clientId: string) {
    const client = this.controller.findClientFromWidgetId(clientId);
    if (client) {
      client.reset();
      client.attached.promise.then(() => {
        if (client.ready) {
          this.errors.delete(clientId);
        }
        client.layout();
      });
    }
  }
}
