/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '@opensumi/ide-core-common';

import { Color } from '../common/color';
import {
  ITheme,
  ColorIdentifier,
  ColorDefaults,
  ColorContribution,
  ColorValue,
  ColorFunction,
} from '../common/theme.service';

//  ------ API types

// color registry
export const Extensions = {
  ColorContribution: 'base.contributions.colors',
};

export interface IColorRegistry {
  /**
   * Register a color to the registry.
   * @param id The color id as used in theme description files
   * @param defaults The default values
   * @description the description
   */
  registerColor(id: string, defaults: ColorDefaults, description: string): ColorIdentifier;

  /**
   * Register a color to the registry.
   */
  deregisterColor(id: string): void;

  /**
   * Get all color contributions
   */
  getColors(): ColorContribution[];

  /**
   * Gets the default color of the given id
   */
  resolveDefaultColor(id: ColorIdentifier, theme: ITheme): Color | undefined;

  onDidColorChangedEvent: Event<void>;
}

class ColorRegistry implements IColorRegistry {
  private colorsById: { [key: string]: ColorContribution };

  private onDidColorChanged: Emitter<void> = new Emitter();

  onDidColorChangedEvent: Event<void> = Event.debounce(this.onDidColorChanged.event, () => {}, 500);

  constructor() {
    this.colorsById = {};
  }

  public registerColor(
    id: string,
    defaults: ColorDefaults | null,
    description: string,
    needsTransparency = false,
    deprecationMessage?: string,
  ): ColorIdentifier {
    const colorContribution: ColorContribution = { id, description, defaults, needsTransparency, deprecationMessage };
    this.colorsById[id] = colorContribution;
    this.onDidColorChanged.fire();
    return id;
  }

  public deregisterColor(id: string): void {
    delete this.colorsById[id];
  }

  public getColors(): ColorContribution[] {
    return Object.keys(this.colorsById).map((id) => this.colorsById[id]);
  }

  public resolveDefaultColor(id: ColorIdentifier, theme: ITheme): Color | undefined {
    const colorDesc = this.colorsById[id];
    if (colorDesc && colorDesc.defaults) {
      const colorValue = colorDesc.defaults[theme.type];
      return resolveColorValue(colorValue, theme);
    }
    return undefined;
  }

  public toString() {
    const sorter = (a: string, b: string) => {
      const cat1 = a.indexOf('.') === -1 ? 0 : 1;
      const cat2 = b.indexOf('.') === -1 ? 0 : 1;
      if (cat1 !== cat2) {
        return cat1 - cat2;
      }
      return a.localeCompare(b);
    };

    return Object.keys(this.colorsById)
      .sort(sorter)
      .map((k) => `- \`${k}\`: ${this.colorsById[k].description}`)
      .join('\n');
  }
}

const colorRegistry = new ColorRegistry();

export function registerColor(
  id: string,
  defaults: ColorDefaults | null,
  description: string,
  needsTransparency?: boolean,
  deprecationMessage?: string,
): ColorIdentifier {
  return colorRegistry.registerColor(id, defaults, description, needsTransparency, deprecationMessage);
}

export function getColorRegistry(): IColorRegistry {
  return colorRegistry;
}

// < --- Workbench (not customizable) --- >

export function WORKBENCH_BACKGROUND(theme: ITheme): Color {
  switch (theme.type) {
    case 'dark':
      return Color.fromHex('#252526');
    case 'light':
      return Color.fromHex('#F3F3F3');
    default:
      return Color.fromHex('#000000');
  }
}

// ----- color functions

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

// ----- implementation

/**
 * @param colorValue Resolve a color value in the context of a theme
 */
function resolveColorValue(colorValue: ColorValue | null, theme: ITheme): Color | undefined {
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

// 导出所有的 color token
export * from './color-tokens';
