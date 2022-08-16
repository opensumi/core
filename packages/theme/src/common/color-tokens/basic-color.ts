import { RGBA, Color } from '../color';
import { transparent } from '../utils';

export const foregroundColor = Color.white;
export const secondaryForegroundColor = transparent(foregroundColor, 0.7);
export const backgroundColor = Color.black;

export const hcBorderColor = new Color(new RGBA(111, 195, 223, 1));
export const hcActiveBorderColor = new Color(new RGBA(243, 133, 24, 1));
