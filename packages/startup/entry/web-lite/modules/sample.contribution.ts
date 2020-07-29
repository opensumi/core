import { Autowired } from '@ali/common-di';
import { Domain, CommandService } from '@ali/ide-core-browser';
import { ClientAppContribution } from '@ali/ide-core-browser';

import { IMetaService } from '../services/meta-service/base';
import { toSCMUri } from '../utils/scm-uri';

@Domain(ClientAppContribution)
export class SampleContribution implements ClientAppContribution {

  @Autowired(CommandService)
  private readonly commands: CommandService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  onDidStart() {
    const gitUri = toSCMUri({
      platform: 'git',
      repo: this.metaService.repo!,
      path: '/README.md',
      ref: 'a9b8074f',
    });
    this.commands.executeCommand(
      'vscode.open',
      gitUri.codeUri,
      { preview: false },
    );
  }
}
