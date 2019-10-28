import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { KeybindingContext } from '@ali/ide-core-browser';
import { TerminalClient } from './terminal.client';
import { ITerminalClient } from '../common';

@Domain(KeybindingContext)
export class TerminalKeybindingContext implements KeybindingContext {
  @Autowired(ITerminalClient)
  terminalClient: TerminalClient;

  readonly id: string = 'terminalFocus';

  isEnabled(): boolean {
    return this.terminalClient.isFocused();
  }
}
