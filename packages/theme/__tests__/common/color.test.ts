// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/color.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color, RGBA, HSLA, HSVA } from '../../src/common/color';

describe('Color', () => {
  test('isLighterColor', () => {
    const color1 = new Color(new HSLA(60, 1, 0.5, 1));
    const color2 = new Color(new HSLA(0, 0, 0.753, 1));

    expect(color1.isLighterThan(color2)).toBeTruthy();

    // Abyss theme
    expect(Color.fromHex('#770811').isLighterThan(Color.fromHex('#000c18'))).toBeTruthy();
  });

  test('getLighterColor', () => {
    const color1 = new Color(new HSLA(60, 1, 0.5, 1));
    const color2 = new Color(new HSLA(0, 0, 0.753, 1));

    expect(color1.hsla).toEqual(Color.getLighterColor(color1, color2).hsla);
    expect(new HSLA(0, 0, 0.916, 1)).toEqual(Color.getLighterColor(color2, color1).hsla);
    expect(new HSLA(0, 0, 0.851, 1)).toEqual(Color.getLighterColor(color2, color1, 0.3).hsla);
    expect(new HSLA(0, 0, 0.981, 1)).toEqual(Color.getLighterColor(color2, color1, 0.7).hsla);
    expect(new HSLA(0, 0, 1, 1)).toEqual(Color.getLighterColor(color2, color1, 1).hsla);

  });

  test('isDarkerColor', () => {
    const color1 = new Color(new HSLA(60, 1, 0.5, 1));
    const color2 = new Color(new HSLA(0, 0, 0.753, 1));

    expect(color2.isDarkerThan(color1)).toBeTruthy();

  });

  test('getDarkerColor', () => {
    const color1 = new Color(new HSLA(60, 1, 0.5, 1));
    const color2 = new Color(new HSLA(0, 0, 0.753, 1));

    expect(color2.hsla).toEqual(Color.getDarkerColor(color2, color1).hsla);
    expect(new HSLA(60, 1, 0.392, 1)).toEqual(Color.getDarkerColor(color1, color2).hsla);
    expect(new HSLA(60, 1, 0.435, 1)).toEqual(Color.getDarkerColor(color1, color2, 0.3).hsla);
    expect(new HSLA(60, 1, 0.349, 1)).toEqual(Color.getDarkerColor(color1, color2, 0.7).hsla);
    expect(new HSLA(60, 1, 0.284, 1)).toEqual(Color.getDarkerColor(color1, color2, 1).hsla);

    // Abyss theme
    expect(new HSLA(355, 0.874, 0.157, 1)).toEqual(
      Color.getDarkerColor(Color.fromHex('#770811'), Color.fromHex('#000c18'), 0.4).hsla,
    );
  });

  test('luminance', () => {
    expect(0).toEqual(new Color(new RGBA(0, 0, 0, 1)).getRelativeLuminance());
    expect(1).toEqual(new Color(new RGBA(255, 255, 255, 1)).getRelativeLuminance());

    expect(0.2126).toEqual(new Color(new RGBA(255, 0, 0, 1)).getRelativeLuminance());
    expect(0.7152).toEqual(new Color(new RGBA(0, 255, 0, 1)).getRelativeLuminance());
    expect(0.0722).toEqual(new Color(new RGBA(0, 0, 255, 1)).getRelativeLuminance());

    expect(0.9278).toEqual(new Color(new RGBA(255, 255, 0, 1)).getRelativeLuminance());
    expect(0.7874).toEqual(new Color(new RGBA(0, 255, 255, 1)).getRelativeLuminance());
    expect(0.2848).toEqual(new Color(new RGBA(255, 0, 255, 1)).getRelativeLuminance());

    expect(0.5271).toEqual(new Color(new RGBA(192, 192, 192, 1)).getRelativeLuminance());

    expect(0.2159).toEqual(new Color(new RGBA(128, 128, 128, 1)).getRelativeLuminance());
    expect(0.0459).toEqual(new Color(new RGBA(128, 0, 0, 1)).getRelativeLuminance());
    expect(0.2003).toEqual(new Color(new RGBA(128, 128, 0, 1)).getRelativeLuminance());
    expect(0.1544).toEqual(new Color(new RGBA(0, 128, 0, 1)).getRelativeLuminance());
    expect(0.0615).toEqual(new Color(new RGBA(128, 0, 128, 1)).getRelativeLuminance());
    expect(0.17).toEqual(new Color(new RGBA(0, 128, 128, 1)).getRelativeLuminance());
    expect(0.0156).toEqual(new Color(new RGBA(0, 0, 128, 1)).getRelativeLuminance());
  });

  test('blending', () => {
    expect(new Color(new RGBA(0, 0, 0, 0)).blend(new Color(new RGBA(243, 34, 43)))).toEqual(new Color(new RGBA(243, 34, 43)));
    expect(new Color(new RGBA(255, 255, 255)).blend(new Color(new RGBA(243, 34, 43)))).toEqual(new Color(new RGBA(255, 255, 255)));
    expect(
      new Color(new RGBA(122, 122, 122, 0.7)).blend(new Color(new RGBA(243, 34, 43))),
    ).toEqual(new Color(new RGBA(158, 95, 98)));
    expect(
      new Color(new RGBA(0, 0, 0, 0.58)).blend(new Color(new RGBA(255, 255, 255, 0.33))),
    ).toEqual(new Color(new RGBA(49, 49, 49, 0.719)));
  });

  describe('HSLA', () => {
    test('HSLA.toRGBA', () => {
      expect(HSLA.toRGBA(new HSLA(0, 0, 0, 0))).toEqual(new RGBA(0, 0, 0, 0));
      expect(HSLA.toRGBA(new HSLA(0, 0, 0, 1))).toEqual(new RGBA(0, 0, 0, 1));
      expect(HSLA.toRGBA(new HSLA(0, 0, 1, 1))).toEqual(new RGBA(255, 255, 255, 1));

      expect(HSLA.toRGBA(new HSLA(0, 1, 0.5, 1))).toEqual(new RGBA(255, 0, 0, 1));
      expect(HSLA.toRGBA(new HSLA(120, 1, 0.5, 1))).toEqual(new RGBA(0, 255, 0, 1));
      expect(HSLA.toRGBA(new HSLA(240, 1, 0.5, 1))).toEqual(new RGBA(0, 0, 255, 1));

      expect(HSLA.toRGBA(new HSLA(60, 1, 0.5, 1))).toEqual(new RGBA(255, 255, 0, 1));
      expect(HSLA.toRGBA(new HSLA(180, 1, 0.5, 1))).toEqual(new RGBA(0, 255, 255, 1));
      expect(HSLA.toRGBA(new HSLA(300, 1, 0.5, 1))).toEqual(new RGBA(255, 0, 255, 1));

      expect(HSLA.toRGBA(new HSLA(0, 0, 0.753, 1))).toEqual(new RGBA(192, 192, 192, 1));

      expect(HSLA.toRGBA(new HSLA(0, 0, 0.502, 1))).toEqual(new RGBA(128, 128, 128, 1));
      expect(HSLA.toRGBA(new HSLA(0, 1, 0.251, 1))).toEqual(new RGBA(128, 0, 0, 1));
      expect(HSLA.toRGBA(new HSLA(60, 1, 0.251, 1))).toEqual(new RGBA(128, 128, 0, 1));
      expect(HSLA.toRGBA(new HSLA(120, 1, 0.251, 1))).toEqual(new RGBA(0, 128, 0, 1));
      expect(HSLA.toRGBA(new HSLA(300, 1, 0.251, 1))).toEqual(new RGBA(128, 0, 128, 1));
      expect(HSLA.toRGBA(new HSLA(180, 1, 0.251, 1))).toEqual(new RGBA(0, 128, 128, 1));
      expect(HSLA.toRGBA(new HSLA(240, 1, 0.251, 1))).toEqual(new RGBA(0, 0, 128, 1));
    });

    test('HSLA.fromRGBA', () => {
      expect(HSLA.fromRGBA(new RGBA(0, 0, 0, 0))).toEqual(new HSLA(0, 0, 0, 0));
      expect(HSLA.fromRGBA(new RGBA(0, 0, 0, 1))).toEqual(new HSLA(0, 0, 0, 1));
      expect(HSLA.fromRGBA(new RGBA(255, 255, 255, 1))).toEqual(new HSLA(0, 0, 1, 1));

      expect(HSLA.fromRGBA(new RGBA(255, 0, 0, 1))).toEqual(new HSLA(0, 1, 0.5, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 255, 0, 1))).toEqual(new HSLA(120, 1, 0.5, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 0, 255, 1))).toEqual(new HSLA(240, 1, 0.5, 1));

      expect(HSLA.fromRGBA(new RGBA(255, 255, 0, 1))).toEqual(new HSLA(60, 1, 0.5, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 255, 255, 1))).toEqual(new HSLA(180, 1, 0.5, 1));
      expect(HSLA.fromRGBA(new RGBA(255, 0, 255, 1))).toEqual(new HSLA(300, 1, 0.5, 1));

      expect(HSLA.fromRGBA(new RGBA(192, 192, 192, 1))).toEqual(new HSLA(0, 0, 0.753, 1));

      expect(HSLA.fromRGBA(new RGBA(128, 128, 128, 1))).toEqual(new HSLA(0, 0, 0.502, 1));
      expect(HSLA.fromRGBA(new RGBA(128, 0, 0, 1))).toEqual(new HSLA(0, 1, 0.251, 1));
      expect(HSLA.fromRGBA(new RGBA(128, 128, 0, 1))).toEqual(new HSLA(60, 1, 0.251, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 128, 0, 1))).toEqual(new HSLA(120, 1, 0.251, 1));
      expect(HSLA.fromRGBA(new RGBA(128, 0, 128, 1))).toEqual(new HSLA(300, 1, 0.251, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 128, 128, 1))).toEqual(new HSLA(180, 1, 0.251, 1));
      expect(HSLA.fromRGBA(new RGBA(0, 0, 128, 1))).toEqual(new HSLA(240, 1, 0.251, 1));
    });
  });

  describe('HSVA', () => {
    test('HSVA.toRGBA', () => {
      expect(HSVA.toRGBA(new HSVA(0, 0, 0, 0))).toEqual(new RGBA(0, 0, 0, 0));
      expect(HSVA.toRGBA(new HSVA(0, 0, 0, 1))).toEqual(new RGBA(0, 0, 0, 1));
      expect(HSVA.toRGBA(new HSVA(0, 0, 1, 1))).toEqual(new RGBA(255, 255, 255, 1));

      expect(HSVA.toRGBA(new HSVA(0, 1, 1, 1))).toEqual(new RGBA(255, 0, 0, 1));
      expect(HSVA.toRGBA(new HSVA(120, 1, 1, 1))).toEqual(new RGBA(0, 255, 0, 1));
      expect(HSVA.toRGBA(new HSVA(240, 1, 1, 1))).toEqual(new RGBA(0, 0, 255, 1));

      expect(HSVA.toRGBA(new HSVA(60, 1, 1, 1))).toEqual(new RGBA(255, 255, 0, 1));
      expect(HSVA.toRGBA(new HSVA(180, 1, 1, 1))).toEqual(new RGBA(0, 255, 255, 1));
      expect(HSVA.toRGBA(new HSVA(300, 1, 1, 1))).toEqual(new RGBA(255, 0, 255, 1));

      expect(HSVA.toRGBA(new HSVA(0, 0, 0.753, 1))).toEqual(new RGBA(192, 192, 192, 1));

      expect(HSVA.toRGBA(new HSVA(0, 0, 0.502, 1))).toEqual(new RGBA(128, 128, 128, 1));
      expect(HSVA.toRGBA(new HSVA(0, 1, 0.502, 1))).toEqual(new RGBA(128, 0, 0, 1));
      expect(HSVA.toRGBA(new HSVA(60, 1, 0.502, 1))).toEqual(new RGBA(128, 128, 0, 1));
      expect(HSVA.toRGBA(new HSVA(120, 1, 0.502, 1))).toEqual(new RGBA(0, 128, 0, 1));
      expect(HSVA.toRGBA(new HSVA(300, 1, 0.502, 1))).toEqual(new RGBA(128, 0, 128, 1));
      expect(HSVA.toRGBA(new HSVA(180, 1, 0.502, 1))).toEqual(new RGBA(0, 128, 128, 1));
      expect(HSVA.toRGBA(new HSVA(240, 1, 0.502, 1))).toEqual(new RGBA(0, 0, 128, 1));

      expect(HSVA.toRGBA(new HSVA(360, 0, 0, 0))).toEqual(new RGBA(0, 0, 0, 0));
      expect(HSVA.toRGBA(new HSVA(360, 0, 0, 1))).toEqual(new RGBA(0, 0, 0, 1));
      expect(HSVA.toRGBA(new HSVA(360, 0, 1, 1))).toEqual(new RGBA(255, 255, 255, 1));
      expect(HSVA.toRGBA(new HSVA(360, 0, 0.753, 1))).toEqual(new RGBA(192, 192, 192, 1));
      expect(HSVA.toRGBA(new HSVA(360, 0, 0.502, 1))).toEqual(new RGBA(128, 128, 128, 1));
    });

    test('HSVA.fromRGBA', () => {

      expect(HSVA.fromRGBA(new RGBA(0, 0, 0, 0))).toEqual(new HSVA(0, 0, 0, 0));
      expect(HSVA.fromRGBA(new RGBA(0, 0, 0, 1))).toEqual(new HSVA(0, 0, 0, 1));
      expect(HSVA.fromRGBA(new RGBA(255, 255, 255, 1))).toEqual(new HSVA(0, 0, 1, 1));

      expect(HSVA.fromRGBA(new RGBA(255, 0, 0, 1))).toEqual(new HSVA(0, 1, 1, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 255, 0, 1))).toEqual(new HSVA(120, 1, 1, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 0, 255, 1))).toEqual(new HSVA(240, 1, 1, 1));

      expect(HSVA.fromRGBA(new RGBA(255, 255, 0, 1))).toEqual(new HSVA(60, 1, 1, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 255, 255, 1))).toEqual(new HSVA(180, 1, 1, 1));
      expect(HSVA.fromRGBA(new RGBA(255, 0, 255, 1))).toEqual(new HSVA(300, 1, 1, 1));

      expect(HSVA.fromRGBA(new RGBA(192, 192, 192, 1))).toEqual(new HSVA(0, 0, 0.753, 1));

      expect(HSVA.fromRGBA(new RGBA(128, 128, 128, 1))).toEqual(new HSVA(0, 0, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(128, 0, 0, 1))).toEqual(new HSVA(0, 1, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(128, 128, 0, 1))).toEqual(new HSVA(60, 1, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 128, 0, 1))).toEqual(new HSVA(120, 1, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(128, 0, 128, 1))).toEqual(new HSVA(300, 1, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 128, 128, 1))).toEqual(new HSVA(180, 1, 0.502, 1));
      expect(HSVA.fromRGBA(new RGBA(0, 0, 128, 1))).toEqual(new HSVA(240, 1, 0.502, 1));
    });

    test('Keep hue value when saturation is 0', () => {
      expect(HSVA.toRGBA(new HSVA(10, 0, 0, 0))).toEqual(HSVA.toRGBA(new HSVA(20, 0, 0, 0)));
      expect(new Color(new HSVA(10, 0, 0, 0)).rgba).toEqual(new Color(new HSVA(20, 0, 0, 0)).rgba);
      expect(new Color(new HSVA(10, 0, 0, 0)).hsva).not.toEqual(new Color(new HSVA(20, 0, 0, 0)).hsva);
    });

    test('bug#36240', () => {
      expect(HSVA.fromRGBA(new RGBA(92, 106, 196, 1))).toEqual(new HSVA(232, 0.531, 0.769, 1));
      expect(HSVA.toRGBA(HSVA.fromRGBA(new RGBA(92, 106, 196, 1)))).toEqual(new RGBA(92, 106, 196, 1));
    });
  });

  describe('Format', () => {
    describe('CSS', () => {
      test('parseHex', () => {

        // invalid
        expect(Color.Format.CSS.parseHex('')).toEqual(null);
        expect(Color.Format.CSS.parseHex('#')).toEqual(null);
        expect(Color.Format.CSS.parseHex('#0102030')).toEqual(null);

        // somewhat valid
        expect(Color.Format.CSS.parseHex('#FFFFG0')!.rgba).toEqual(new RGBA(255, 255, 0, 1));
        expect(Color.Format.CSS.parseHex('#FFFFg0')!.rgba).toEqual(new RGBA(255, 255, 0, 1));
        expect(Color.Format.CSS.parseHex('#-FFF00')!.rgba).toEqual(new RGBA(15, 255, 0, 1));

        // valid
        expect(Color.Format.CSS.parseHex('#000000')!.rgba).toEqual(new RGBA(0, 0, 0, 1));
        expect(Color.Format.CSS.parseHex('#FFFFFF')!.rgba).toEqual(new RGBA(255, 255, 255, 1));

        expect(Color.Format.CSS.parseHex('#FF0000')!.rgba).toEqual(new RGBA(255, 0, 0, 1));
        expect(Color.Format.CSS.parseHex('#00FF00')!.rgba).toEqual(new RGBA(0, 255, 0, 1));
        expect(Color.Format.CSS.parseHex('#0000FF')!.rgba).toEqual(new RGBA(0, 0, 255, 1));

        expect(Color.Format.CSS.parseHex('#FFFF00')!.rgba).toEqual(new RGBA(255, 255, 0, 1));
        expect(Color.Format.CSS.parseHex('#00FFFF')!.rgba).toEqual(new RGBA(0, 255, 255, 1));
        expect(Color.Format.CSS.parseHex('#FF00FF')!.rgba).toEqual(new RGBA(255, 0, 255, 1));

        expect(Color.Format.CSS.parseHex('#C0C0C0')!.rgba).toEqual(new RGBA(192, 192, 192, 1));

        expect(Color.Format.CSS.parseHex('#808080')!.rgba).toEqual(new RGBA(128, 128, 128, 1));
        expect(Color.Format.CSS.parseHex('#800000')!.rgba).toEqual(new RGBA(128, 0, 0, 1));
        expect(Color.Format.CSS.parseHex('#808000')!.rgba).toEqual(new RGBA(128, 128, 0, 1));
        expect(Color.Format.CSS.parseHex('#008000')!.rgba).toEqual(new RGBA(0, 128, 0, 1));
        expect(Color.Format.CSS.parseHex('#800080')!.rgba).toEqual(new RGBA(128, 0, 128, 1));
        expect(Color.Format.CSS.parseHex('#008080')!.rgba).toEqual(new RGBA(0, 128, 128, 1));
        expect(Color.Format.CSS.parseHex('#000080')!.rgba).toEqual(new RGBA(0, 0, 128, 1));

        expect(Color.Format.CSS.parseHex('#010203')!.rgba).toEqual(new RGBA(1, 2, 3, 1));
        expect(Color.Format.CSS.parseHex('#040506')!.rgba).toEqual(new RGBA(4, 5, 6, 1));
        expect(Color.Format.CSS.parseHex('#070809')!.rgba).toEqual(new RGBA(7, 8, 9, 1));
        expect(Color.Format.CSS.parseHex('#0a0A0a')!.rgba).toEqual(new RGBA(10, 10, 10, 1));
        expect(Color.Format.CSS.parseHex('#0b0B0b')!.rgba).toEqual(new RGBA(11, 11, 11, 1));
        expect(Color.Format.CSS.parseHex('#0c0C0c')!.rgba).toEqual(new RGBA(12, 12, 12, 1));
        expect(Color.Format.CSS.parseHex('#0d0D0d')!.rgba).toEqual(new RGBA(13, 13, 13, 1));
        expect(Color.Format.CSS.parseHex('#0e0E0e')!.rgba).toEqual(new RGBA(14, 14, 14, 1));
        expect(Color.Format.CSS.parseHex('#0f0F0f')!.rgba).toEqual(new RGBA(15, 15, 15, 1));
        expect(Color.Format.CSS.parseHex('#a0A0a0')!.rgba).toEqual(new RGBA(160, 160, 160, 1));
        expect(Color.Format.CSS.parseHex('#CFA')!.rgba).toEqual(new RGBA(204, 255, 170, 1));
        expect(Color.Format.CSS.parseHex('#CFA8')!.rgba).toEqual(new RGBA(204, 255, 170, 0.533));
      });
    });
  });
});
