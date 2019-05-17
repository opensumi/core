import { NodeModule } from '@ali/ide-core-node';
import { FileSystemNodeOptions } from './file-service';

export * from './file-service';

export class FileServiceModule extends NodeModule {
  providers = [{ token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT }]
}
