import { Injectable, Autowired } from '@opensumi/di';
import { URI, Schemas, CommandService } from '@opensumi/ide-core-common';

import { IOpener } from '.';

@Injectable()
export class CommandOpener implements IOpener {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  handleScheme(scheme: string) {
    return scheme === Schemas.command;
  }

  static parseURI(uri: URI) {
    // execute as command
    let args: any = [];
    try {
      args = JSON.parse(decodeURIComponent(uri.query));
    } catch {
      // ignore and retry
      try {
        args = JSON.parse(uri.query);
      } catch {
        // ignore error
      }
    }
    if (!Array.isArray(args)) {
      args = [args];
    }
    return {
      id: uri.path.toString(),
      args,
    };
  }

  async open(uri: URI) {
    const { id, args } = CommandOpener.parseURI(uri);
    await this.commandService.executeCommand(id, ...args);
    return true;
  }
}
