import { isOSX, isWindows } from '@ide-framework/ide-core-common';

import { requireRegister as requireDarwinRegister } from './layout.contribution.darwin';
import { requireRegister as requireWinRegister } from './layout.contribution.win';
import { requireRegister as requireLinuxRegister } from './layout.contribution.linux';

export const requireRegister = isWindows ? requireWinRegister : isOSX ? requireDarwinRegister : requireLinuxRegister;

export { KeyboardLayoutContribution } from './_.contribution';
