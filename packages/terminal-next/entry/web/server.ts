import { startServer } from '@ali/ide-dev-tool/src/server';
import { TerminalNodePtyModule } from '@ali/ide-terminal-next/lib/node';
import { LogServiceModule } from '@ali/ide-logs/lib/node';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';

startServer({
  modules: [
    LogServiceModule,
    FileServiceModule,
    TerminalNodePtyModule,
  ],
});
