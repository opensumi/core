import { localize } from '@ide-framework/ide-core-common';
import { registerColor } from '../color-registry';
import { Color } from '../../common/color';
import { contrastBorder } from './base';

export const progressBarBackground = registerColor('progressBar.background', { dark: Color.fromHex('#0E70C0'), light: Color.fromHex('#0E70C0'), hc: contrastBorder }, localize('progressBarBackground', 'Background color of the progress bar that can show for long running operations.'));
