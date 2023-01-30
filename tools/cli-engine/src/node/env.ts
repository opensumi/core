import os from 'os';
import path from 'path';

import * as ip from 'ip';

import { StoragePaths } from '@opensumi/ide-core-common';

export const CLI_DEVELOPMENT_PATH = path.join(os.homedir(), `${StoragePaths.DEFAULT_STORAGE_DIR_NAME}-dev`);
export const CLIENT_IP = ip.address();
