import { RemoteService } from '@opensumi/ide-core-common';

import { DiskFileServicePath } from '../common';
import { DiskFileServiceProtocol } from '../common/protocols/disk-file-service';

import { DiskFileSystemProvider } from './disk-file-system.provider';

@RemoteService(DiskFileServicePath, DiskFileServiceProtocol)
export class DiskFileRemoteService extends DiskFileSystemProvider {}
