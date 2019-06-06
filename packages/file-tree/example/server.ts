
import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service/src/node';

startServer({
  modules: [
    FileServiceModule,
  ],
});
