import { FileChangeType } from '@opensumi/ide-core-common';

export interface DriverFileChange {
  path: string;
  type: FileChangeType;
}
