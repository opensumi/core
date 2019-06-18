import { URI } from '@ali/ide-core-common';
import { Version } from './version';

export interface IRawFileReference {
  uri: URI;
  version: Version;
}
