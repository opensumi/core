import { Autowired, Injectable } from '@opensumi/di';
import { ClientAppContribution, Domain, IDisposable } from '@opensumi/ide-core-browser';

import {
  ChatInputFooterRegistry,
  ChatInputFooterRegistryToken,
  FooterButtonPosition,
} from '../../chat/chat-input-footer.registry';

import { AcpSlashCommandFooter } from './AcpFooterButtons';

@Injectable()
@Domain(ClientAppContribution)
export class AcpFooterContribution implements ClientAppContribution {
  @Autowired(ChatInputFooterRegistryToken)
  private readonly footerRegistry: ChatInputFooterRegistry;

  private registrationDisposables: IDisposable[] = [];

  initialize(): void {
    this.registrationDisposables.push(
      this.footerRegistry.registerFooterItem('slash-commands', {
        component: AcpSlashCommandFooter,
        order: 20,
        position: FooterButtonPosition.LEFT,
      }),
    );
  }

  dispose(): void {
    this.registrationDisposables.forEach((d) => d.dispose());
    this.registrationDisposables = [];
  }
}
