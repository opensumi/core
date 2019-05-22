import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service';
import { Injector } from '@ali/common-di';

const injecttor = new Injector();
startServer([injecttor.get(FileServiceModule)]);

// startServer([]);
