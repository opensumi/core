import { Autowired, Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-core-common';

import {
  IPtyExitEvent,
  ITerminalController,
  ITerminalError,
  ITerminalErrorService,
  ITerminalGroupViewService,
  ITerminalService,
} from '../common';

@Injectable()
export class TerminalErrorService implements ITerminalErrorService {
  errors: Map<string, ITerminalError> = new Map();

  protected _onErrorsChangeEmitter = new Emitter<void>();
  onErrorsChange = this._onErrorsChangeEmitter.event;

  @Autowired(ITerminalService)
  protected readonly service: ITerminalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  constructor() {
    this.service.onError((error) => {
      this.errors.set(error.id, error);
      this._onErrorsChangeEmitter.fire();
    });

    this.service.onExit((event: IPtyExitEvent) => {
      try {
        const widget = this.view.getWidget(event.sessionId);
        if (!widget.reuse) {
          this.view.removeWidget(event.sessionId);
        }
      } catch (_e) {
        /** nothing */
      }
    });

    this.controller.onDidCloseTerminal((e) => {
      this.errors.delete(e.id);
      this._onErrorsChangeEmitter.fire();
    });
  }

  async fix(clientId: string) {
    const client = this.controller.findClientFromWidgetId(clientId);
    if (client) {
      await 0; // 使后面的 delete 发生在下一个 microTask 中，避免在迭代过程中修改 this.errors
      this.errors.delete(clientId);
      this._onErrorsChangeEmitter.fire();

      client.reset();
      return client.attached.promise;
    }
  }
}
