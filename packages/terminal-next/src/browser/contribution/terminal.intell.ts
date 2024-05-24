import { Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import {
  MaybePromise,
} from '@opensumi/ide-core-common';

import { IntellTerminalService } from '../intell/intell-terminal.service';

@Domain(ClientAppContribution)
export class TerminalIntellContribution implements ClientAppContribution {

  @Autowired(IntellTerminalService)
  intellTerminalService: IntellTerminalService;

  onDidStart(): MaybePromise<void> {
    this.intellTerminalService.active();
  }
}
