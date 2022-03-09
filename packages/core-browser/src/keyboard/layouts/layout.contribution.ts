import { isOSX, isWindows } from '@opensumi/ide-core-common';

import { requireRegister as requireDarwinRegister } from './layout.contribution.darwin';
import { requireRegister as requireLinuxRegister } from './layout.contribution.linux';
import { requireRegister as requireWinRegister } from './layout.contribution.win';

export const requireRegister = isWindows ? requireWinRegister : isOSX ? requireDarwinRegister : requireLinuxRegister;

export { KeyboardLayoutContribution } from './_.contribution';
