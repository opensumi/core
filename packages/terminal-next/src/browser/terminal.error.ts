import { observable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';

import {
  ITerminalErrorService,
  ITerminalError,
  ITerminalService,
  ITerminalGroupViewService,
  ITerminalController,
  IPtyExitEvent,
} from '../common';

@Injectable()
export class TerminalErrorService implements ITerminalErrorService {
  @observable
  errors: Map<string, ITerminalError> = new Map();

  @Autowired(ITerminalService)
  protected readonly service: ITerminalService;

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
      } catch {
        /** nothing */
      }
    });

    this.controller.onDidCloseTerminal((e) => {
      this.errors.delete(e.id);
    });
  }

  async fix(clientId: string) {
    const client = this.controller.findClientFromWidgetId(clientId);
    if (client) {
      await 0; // 使后面的 delete 发生在下一个 microTask 中，避免在迭代过程中修改 this.errors
      this.errors.delete(clientId);
      client.reset();
      return client.attached.promise;
    }
  }
}
