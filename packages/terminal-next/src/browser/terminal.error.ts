import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { ITerminalErrorService, ITerminalError, ITerminalExternalService } from '../common';

@Injectable()
export class TerminalErrorService implements ITerminalErrorService {
  @observable
  errors: Map<string, ITerminalError> = new Map();

  @Autowired(ITerminalExternalService)
  protected readonly service: ITerminalExternalService;

  constructor() {
    this.service.onError((error) => {
      this.errors.set(error.id, error);
    });
  }

  fix(clientId: string) {
    this.errors.delete(clientId);
  }
}
