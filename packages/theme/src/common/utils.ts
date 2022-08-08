import { Color } from './color';
import { ColorValue, ColorFunction, ITheme } from './theme.service';

export function darken(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.darken(factor);
    }
    return undefined;
  };
}

export function lighten(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.lighten(factor);
    }
    return undefined;
  };
}

export function transparent(colorValue: ColorValue, factor: number): ColorFunction {
  return (theme) => {
    const color = resolveColorValue(colorValue, theme);
    if (color) {
      return color.transparent(factor);
    }
    return undefined;
  };
}

export function oneOf(...colorValues: ColorValue[]): ColorFunction {
  return (theme) => {
    for (const colorValue of colorValues) {
      const color = resolveColorValue(colorValue, theme);
      if (color) {
        return color;
      }
    }
    return undefined;
  };
}

export function lessProminent(
  colorValue: ColorValue,
  backgroundColorValue: ColorValue,
  factor: number,
  transparency: number,
): ColorFunction {
  return (theme) => {
    const from = resolveColorValue(colorValue, theme);
    if (from) {
      const backgroundColor = resolveColorValue(backgroundColorValue, theme);
      if (backgroundColor) {
        if (from.isDarkerThan(backgroundColor)) {
          return Color.getLighterColor(from, backgroundColor, factor).transparent(transparency);
        }
        return Color.getDarkerColor(from, backgroundColor, factor).transparent(transparency);
      }
      return from.transparent(factor * transparency);
    }
    return undefined;
  };
}

/**
 * @param colorValue Resolve a color value in the context of a theme
 */
export function resolveColorValue(colorValue: ColorValue | null, theme: ITheme): Color | undefined {
  if (colorValue === null) {
    return undefined;
  } else if (colorValue === 'transparent') {
    return Color.fromHex('#00000000');
  } else if (typeof colorValue === 'string') {
    if (colorValue[0] === '#') {
      return Color.fromHex(colorValue);
    }
    return theme.getColor(colorValue);
  } else if (colorValue instanceof Color) {
    return colorValue;
  } else if (typeof colorValue === 'function') {
    return colorValue(theme) as Color;
  }
  return undefined;
}
