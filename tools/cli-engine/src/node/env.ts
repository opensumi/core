import os from 'os';
import path from 'path';

import * as ip from 'ip';

export const DEV_PATH = path.join(os.homedir(), '.opensumi-dev');
export const CLIENT_IP = ip.address();
