import * as ip from 'ip';
import path from 'path';
import os from 'os';

export const DEV_PATH = path.join(os.homedir(), '.opensumi-dev');
export const CLIENT_IP = ip.address();
