import * as ip from 'ip';
import * as path from 'path';
import * as os from 'os';

export const DEV_PATH = path.join(os.homedir(), '.kaitian-dev');
export const CLIENT_IP = ip.address();
