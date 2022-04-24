/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/debug/test/browser/debugANSIHandling.test.ts

import { IOpenerService, uuid } from '@opensumi/ide-core-browser';
import {
  appendStylizedStringToContainer,
  calcANSI8bitColor,
  handleANSIOutput,
} from '@opensumi/ide-debug/lib/browser/debug-ansi-handle';
import { LinkDetector } from '@opensumi/ide-debug/lib/browser/debug-link-detector';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { registerTerminalColors } from '@opensumi/ide-terminal-next/lib/browser/terminal.color';
import { Color, IThemeService, RGBA } from '@opensumi/ide-theme';
import { SemanticTokenRegistryImpl } from '@opensumi/ide-theme/lib/browser/semantic-tokens-registry';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import { OpenerService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/openerService';

function assert(value: any, message?: string | Error) {
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(message);
  }
  expect(value).toBeTruthy();
}

describe('Debug - ANSI escape sequence', () => {
  let linkDetector: LinkDetector;
  let themeService: IThemeService;

  const injector = createBrowserInjector(
    [],
    new MockInjector([
      {
        token: WorkbenchEditorService,
        useValue: WorkbenchEditorService,
      },
      {
        token: IFileServiceClient,
        useValue: {
          getFileStat: jest.fn((uri: string) => Promise.resolve(undefined)),
        },
      },
      {
        token: IOpenerService,
        useValue: OpenerService,
      },
      {
        token: IThemeService,
        useClass: WorkbenchThemeService,
      },
      {
        token: ISemanticTokenRegistry,
        useClass: SemanticTokenRegistryImpl,
      },
    ]),
  );

  registerTerminalColors();

  beforeAll(() => {
    linkDetector = injector.get(LinkDetector);
    themeService = injector.get(IThemeService);
  });

  test('appendStylizedStringToContainer', () => {
    const root: HTMLSpanElement = document.createElement('span');
    let child: Node;

    expect(root.children.length).toStrictEqual(0);

    appendStylizedStringToContainer(root, 'content1', ['class1', 'class2'], linkDetector, undefined);
    appendStylizedStringToContainer(root, 'content2', ['class2', 'class3'], linkDetector, undefined);

    expect(root.children.length).toStrictEqual(2);

    child = root.firstChild!;
    if (child instanceof HTMLElement) {
      expect(child.textContent).toStrictEqual('content1');
      expect(child.classList).toContain('class1');
      expect(child.classList).toContain('class2');
    } else {
      throw new Error('Unexpected assertion error');
    }

    child = root.lastChild!;
    if (child instanceof HTMLElement) {
      expect(child.textContent).toStrictEqual('content2');
      expect(child.classList).toContain('class2');
      expect(child.classList).toContain('class3');
    } else {
      throw new Error('Unexpected assertion error');
    }
  });

  /**
   * Apply an ANSI sequence to {@link #getSequenceOutput}.
   *
   * @param sequence The ANSI sequence to stylize.
   * @returns An {@link HTMLSpanElement} that contains the stylized text.
   */
  async function getSequenceOutput(sequence: string): Promise<HTMLSpanElement> {
    const root: HTMLSpanElement = await handleANSIOutput(sequence, linkDetector, themeService, undefined);
    expect(root.children.length).toStrictEqual(1);
    const child: Node = root.lastChild!;
    if (child instanceof HTMLSpanElement) {
      return child;
    } else {
      throw new Error('Unexpected error: getSequenceOutput > child is not instanceof HTMLSpanElement');
    }
  }

  /**
   * Assert that a given ANSI sequence maintains added content following the ANSI code, and that
   * the provided {@param assertion} passes.
   *
   * @param sequence The ANSI sequence to verify. The provided sequence should contain ANSI codes
   * only, and should not include actual text content as it is provided by this function.
   * @param assertion The function used to verify the output.
   */
  async function assertSingleSequenceElement(
    sequence: string,
    assertion: (child: HTMLSpanElement) => void,
  ): Promise<void> {
    const child: HTMLSpanElement = await getSequenceOutput(sequence + 'content');
    expect(child.textContent).toStrictEqual('content');
    assertion(child);
  }

  /**
   * Assert that a given DOM element has the custom inline CSS style matching
   * the color value provided.
   * @param element The HTML span element to look at.
   * @param colorType If `foreground`, will check the element's css `color`;
   * if `background`, will check the element's css `backgroundColor`.
   * if `underline`, will check the elements css `textDecorationColor`.
   * @param color RGBA object to compare color to. If `undefined` or not provided,
   * will assert that no value is set.
   * @param message Optional custom message to pass to assertion.
   * @param colorShouldMatch Optional flag (defaults TO true) which allows caller to indicate that the color SHOULD NOT MATCH
   * (for testing changes to theme colors where we need color to have changed but we don't know exact color it should have
   * changed to (but we do know the color it should NO LONGER BE))
   */
  function assertInlineColor(
    element: HTMLSpanElement,
    colorType: 'background' | 'foreground' | 'underline',
    color?: RGBA | undefined,
    message?: string,
    colorShouldMatch = true,
  ): void {
    if (color !== undefined) {
      const cssColor = Color.Format.CSS.formatRGB(new Color(color));
      if (colorType === 'background') {
        const styleBefore = element.style.backgroundColor;
        element.style.backgroundColor = cssColor;
        assert(
          (styleBefore === element.style.backgroundColor) === colorShouldMatch,
          message || `Incorrect ${colorType} color style found (found color: ${styleBefore}, expected ${cssColor}).`,
        );
      } else if (colorType === 'foreground') {
        const styleBefore = element.style.color;
        element.style.color = cssColor;
        assert(
          (styleBefore === element.style.color) === colorShouldMatch,
          message || `Incorrect ${colorType} color style found (found color: ${styleBefore}, expected ${cssColor}).`,
        );
      } else {
        const styleBefore = element.style.textDecorationColor;
        element.style.textDecorationColor = cssColor;
        assert(
          (styleBefore === element.style.textDecorationColor) === colorShouldMatch,
          message || `Incorrect ${colorType} color style found (found color: ${styleBefore}, expected ${cssColor}).`,
        );
      }
    } else {
      if (colorType === 'background') {
        assert(
          !element.style.backgroundColor,
          message || `Defined ${colorType} color style found when it should not have been defined`,
        );
      } else if (colorType === 'foreground') {
        assert(
          !element.style.color,
          message || `Defined ${colorType} color style found when it should not have been defined`,
        );
      } else {
        assert(
          !element.style.textDecorationColor,
          message || `Defined ${colorType} color style found when it should not have been defined`,
        );
      }
    }
  }

  test('Expected single sequence operation', async () => {
    // Bold code
    await assertSingleSequenceElement('\x1b[1m', (child) => {
      expect(child.classList).toContain('code-bold'); // 'Bold formatting not detected after bold ANSI code.'
    });

    // Italic code
    await assertSingleSequenceElement('\x1b[3m', (child) => {
      expect(child.classList).toContain('code-italic'); // 'Italic formatting not detected after italic ANSI code.'
    });

    // Underline code
    await assertSingleSequenceElement('\x1b[4m', (child) => {
      // 'Underline formatting not detected after underline ANSI code.',
      expect(child.classList).toContain('code-underline');
    });

    for (let i = 30; i <= 37; i++) {
      const customClassName = 'code-foreground-colored';

      // Foreground colour class
      await assertSingleSequenceElement('\x1b[' + i + 'm', (child) => {
        // `Custom foreground class not found on element after foreground ANSI code #${i}.`,
        expect(child.classList).toContain(customClassName);
      });

      // Cancellation code removes colour class
      await assertSingleSequenceElement('\x1b[' + i + ';39m', (child) => {
        // 'Custom foreground class still found after foreground cancellation code.',
        expect(child.classList).not.toContain(customClassName);

        assertInlineColor(
          child,
          'foreground',
          undefined,
          'Custom color style still found after foreground cancellation code.',
        );
      });
    }

    for (let i = 40; i <= 47; i++) {
      const customClassName = 'code-background-colored';

      // Foreground colour class
      await assertSingleSequenceElement('\x1b[' + i + 'm', (child) => {
        // `Custom background class not found on element after background ANSI code #${i}.`,
        expect(child.classList).toContain(customClassName);
      });

      // Cancellation code removes colour class
      await assertSingleSequenceElement('\x1b[' + i + ';49m', (child) => {
        // 'Custom background class still found after background cancellation code.',
        expect(child.classList).not.toContain(customClassName);

        assertInlineColor(
          child,
          'foreground',
          undefined,
          'Custom color style still found after background cancellation code.',
        );
      });
    }

    const customClassName = 'code-underline-colored';

    // Underline colour class
    await assertSingleSequenceElement('\x1b[58;5;' + 1 + 'm', (child) => {
      // `Custom underline color class not found on element after underline color ANSI code 58;5;${1}m.`,
      expect(child.classList).toContain(customClassName);
    });

    // check all basic colors for underlines (full range is checked elsewhere, here we check cancelation)
    for (let i = 0; i <= 255; i++) {
      const customClassName = 'code-underline-colored';

      // Underline colour class
      await assertSingleSequenceElement('\x1b[58;5;' + i + 'm', (child) => {
        // `Custom underline color class not found on element after underline color ANSI code 58;5;${i}m.`,
        expect(child.classList).toContain(customClassName);
      });

      // Cancellation underline color code removes colour class
      await assertSingleSequenceElement('\x1b[58;5;' + i + 'm\x1b[59m', (child) => {
        // 'Custom underline color class still found after underline color cancellation code 59m.',
        expect(child.classList).not.toContain(customClassName);

        assertInlineColor(
          child,
          'underline',
          undefined,
          'Custom underline color style still found after underline color cancellation code 59m.',
        );
      });
    }

    // Different codes do not cancel each other
    await assertSingleSequenceElement('\x1b[1;3;4;30;41m', (child) => {
      // Incorrect number of classes found for different ANSI codes.
      expect(child.classList.length).toStrictEqual(5);
      expect(child.classList).toContain('code-bold');
      expect(child.classList).toContain('code-italic'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-underline'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-foreground-colored'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-background-colored'); // 'Different ANSI codes should not cancel each other.'
    });

    // Different codes do not ACCUMULATE more than one copy of each class
    await assertSingleSequenceElement('\x1b[1;1;2;2;3;3;4;4;5;5;6;6;8;8;9;9;21;21;53;53;73;73;74;74m', (child) => {
      expect(child.classList).toContain('code-bold');
      // 'italic missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-italic');

      assert(
        child.classList.contains('code-underline') === false,
        'underline PRESENT and double underline should have removed it- Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      );
      // 'dim missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-dim');
      // 'blink missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-blink');
      // 'rapid blink mkssing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-rapid-blink');
      // 'double underline missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-double-underline');
      // 'hidden missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-hidden');
      // 'strike-through missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-strike-through');
      // 'overline missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-overline');
      assert(
        child.classList.contains('code-superscript') === false,
        'superscript PRESENT and subscript should have removed it- Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      );
      // 'subscript missing Doubles of each Different ANSI codes should not cancel each other or accumulate.',
      expect(child.classList).toContain('code-subscript');
      // Incorrect number of classes found for each style code sent twice ANSI codes.,
      expect(child.classList.length).toStrictEqual(10);
    });

    // More Different codes do not cancel each other
    await assertSingleSequenceElement('\x1b[1;2;5;6;21;8;9m', (child) => {
      // Incorrect number of classes found for different ANSI codes.
      expect(child.classList.length).toStrictEqual(7);

      expect(child.classList).toContain('code-bold');
      expect(child.classList).toContain('code-dim'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-blink'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-rapid-blink'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-double-underline'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-hidden'); // 'Different ANSI codes should not cancel each other.'
      expect(child.classList).toContain('code-strike-through'); // 'Different ANSI codes should not cancel each other.'
    });

    // New foreground codes don't remove old background codes and vice versa
    await assertSingleSequenceElement('\x1b[40;31;42;33m', (child) => {
      expect(child.classList.length).toStrictEqual(2);

      // 'New foreground ANSI code should not cancel existing background formatting.',
      expect(child.classList).toContain('code-background-colored');
      // 'New background ANSI code should not cancel existing foreground formatting.',
      expect(child.classList).toContain('code-foreground-colored');
    });

    // Duplicate codes do not change output
    await assertSingleSequenceElement('\x1b[1;1;4;1;4;4;1;4m', (child) => {
      expect(child.classList).toContain('code-bold'); // 'Duplicate formatting codes should have no effect.'
      expect(child.classList).toContain('code-underline'); // 'Duplicate formatting codes should have no effect.'
    });

    // Extra terminating semicolon does not change output
    await assertSingleSequenceElement('\x1b[1;4;m', (child) => {
      expect(child.classList).toContain('code-bold'); // 'Extra semicolon after ANSI codes should have no effect.'
      expect(child.classList).toContain('code-underline'); // 'Extra semicolon after ANSI codes should have no effect.'
    });

    // Cancellation code removes multiple codes
    await assertSingleSequenceElement('\x1b[1;4;30;41;32;43;34;45;36;47;0m', (child) => {
      // Cancellation ANSI code should clear ALL formatting.
      expect(child.classList.length).toStrictEqual(0);

      assertInlineColor(child, 'background', undefined, 'Cancellation ANSI code should clear ALL formatting.');
      assertInlineColor(child, 'foreground', undefined, 'Cancellation ANSI code should clear ALL formatting.');
    });
  });

  test('Expected single 8-bit color sequence operation', async () => {
    // Basic and bright color codes specified with 8-bit color code format
    for (let i = 0; i <= 15; i++) {
      // As these are controlled by theme, difficult to check actual color value
      // Foreground codes should add standard classes
      await assertSingleSequenceElement('\x1b[38;5;' + i + 'm', (child) => {
        // `Custom color class not found after foreground 8-bit color code 38;5;${i}`,
        expect(child.classList).toContain('code-foreground-colored');
      });

      // Background codes should add standard classes
      await assertSingleSequenceElement('\x1b[48;5;' + i + 'm', (child) => {
        // `Custom color class not found after background 8-bit color code 48;5;${i}`,
        expect(child.classList).toContain('code-background-colored');
      });
    }

    // 8-bit advanced colors
    for (let i = 16; i <= 255; i++) {
      // Foreground codes should add custom class and inline style
      await assertSingleSequenceElement('\x1b[38;5;' + i + 'm', (child) => {
        // `Custom color class not found after foreground 8-bit color code 38;5;${i}`,
        expect(child.classList).toContain('code-foreground-colored');
        assertInlineColor(
          child,
          'foreground',
          calcANSI8bitColor(i) as RGBA,
          `Incorrect or no color styling found after foreground 8-bit color code 38;5;${i}`,
        );
      });

      // Background codes should add custom class and inline style
      await assertSingleSequenceElement('\x1b[48;5;' + i + 'm', (child) => {
        // `Custom color class not found after background 8-bit color code 48;5;${i}`,
        expect(child.classList).toContain('code-background-colored');

        assertInlineColor(
          child,
          'background',
          calcANSI8bitColor(i) as RGBA,
          `Incorrect or no color styling found after background 8-bit color code 48;5;${i}`,
        );
      });

      // Color underline codes should add custom class and inline style
      await assertSingleSequenceElement('\x1b[58;5;' + i + 'm', (child) => {
        // `Custom color class not found after underline 8-bit color code 58;5;${i}`,
        expect(child.classList).toContain('code-underline-colored');
        assertInlineColor(
          child,
          'underline',
          calcANSI8bitColor(i) as RGBA,
          `Incorrect or no color styling found after underline 8-bit color code 58;5;${i}`,
        );
      });
    }

    // Bad (nonexistent) color should not render
    await assertSingleSequenceElement('\x1b[48;5;300m', (child) => {
      // Bad ANSI color codes should have no effect.
      expect(child.classList.length).toStrictEqual(0);
    });

    // Should ignore any codes after the ones needed to determine color
    await assertSingleSequenceElement('\x1b[48;5;100;42;77;99;4;24m', (child) => {
      expect(child.classList).toContain('code-background-colored');
      expect(child.classList.length).toStrictEqual(1);
      assertInlineColor(child, 'background', calcANSI8bitColor(100) as RGBA);
    });
  });

  test('Expected single 24-bit color sequence operation', async () => {
    // 24-bit advanced colors
    for (let r = 0; r <= 255; r += 64) {
      for (let g = 0; g <= 255; g += 64) {
        for (let b = 0; b <= 255; b += 64) {
          const color = new RGBA(r, g, b);
          // Foreground codes should add class and inline style
          await assertSingleSequenceElement(`\x1b[38;2;${r};${g};${b}m`, (child) => {
            // 'DOM should have "code-foreground-colored" class for advanced ANSI colors.',
            expect(child.classList).toContain('code-foreground-colored');
            assertInlineColor(child, 'foreground', color);
          });

          // Background codes should add class and inline style
          await assertSingleSequenceElement(`\x1b[48;2;${r};${g};${b}m`, (child) => {
            // 'DOM should have "code-foreground-colored" class for advanced ANSI colors.',
            expect(child.classList).toContain('code-background-colored');
            assertInlineColor(child, 'background', color);
          });

          // Underline color codes should add class and inline style
          await assertSingleSequenceElement(`\x1b[58;2;${r};${g};${b}m`, (child) => {
            // 'DOM should have "code-underline-colored" class for advanced ANSI colors.',
            expect(child.classList).toContain('code-underline-colored');
            assertInlineColor(child, 'underline', color);
          });
        }
      }
    }

    // Invalid color should not render
    await assertSingleSequenceElement('\x1b[38;2;4;4m', (child) => {
      // Invalid color code "38;2;4;4" should not add a class (classes found: ${child.classList}).
      expect(child.classList.length).toStrictEqual(0);
      assert(
        !child.style.color,
        `Invalid color code "38;2;4;4" should not add a custom color CSS (found color: ${child.style.color}).`,
      );
    });

    // Bad (nonexistent) color should not render
    await assertSingleSequenceElement('\x1b[48;2;150;300;5m', (child) => {
      // Nonexistent color code "48;2;150;300;5" should not add a class (classes found: ${child.classList}).
      expect(child.classList.length).toStrictEqual(0);
    });

    // Should ignore any codes after the ones needed to determine color
    await assertSingleSequenceElement('\x1b[48;2;100;42;77;99;200;75m', (child) => {
      // 'Color code with extra (valid) items "48;2;100;42;77;99;200;75" should still treat initial part as valid code and add class "code-background-custom".',
      expect(child.classList).toContain('code-background-colored');

      // Color code with extra items "48;2;100;42;77;99;200;75" should add one and only one class. (classes found: ${child.classList}).
      expect(child.classList.length).toStrictEqual(1);
      assertInlineColor(
        child,
        'background',
        new RGBA(100, 42, 77),
        'Color code "48;2;100;42;77;99;200;75" should  style background-color as rgb(100,42,77).',
      );
    });
  });

  /**
   * Assert that a given ANSI sequence produces the expected number of {@link HTMLSpanElement} children. For
   * each child, run the provided assertion.
   *
   * @param sequence The ANSI sequence to verify.
   * @param assertions A set of assertions to run on the resulting children.
   */
  async function assertMultipleSequenceElements(
    sequence: string,
    assertions: Array<(child: HTMLSpanElement) => void>,
    elementsExpected?: number,
  ): Promise<void> {
    if (elementsExpected === undefined) {
      elementsExpected = assertions.length;
    }
    const root: HTMLSpanElement = await handleANSIOutput(sequence, linkDetector, themeService, undefined);
    expect(root.children.length).toStrictEqual(elementsExpected);
    for (let i = 0; i < elementsExpected; i++) {
      const child: Node = root.children[i];
      if (child instanceof HTMLSpanElement) {
        assertions[i](child);
      } else {
        throw new Error('Unexpected assertion error');
      }
    }
  }

  test('Expected multiple sequence operation', async () => {
    // Multiple codes affect the same text
    await assertSingleSequenceElement('\x1b[1m\x1b[3m\x1b[4m\x1b[32m', (child) => {
      expect(child.classList).toContain('code-bold'); // 'Bold class not found after multiple different ANSI codes.'
      expect(child.classList).toContain('code-italic'); // 'Italic class not found after multiple different ANSI codes.'
      // 'Underline class not found after multiple different ANSI codes.',
      expect(child.classList).toContain('code-underline');
      // 'Foreground color class not found after multiple different ANSI codes.',
      expect(child.classList).toContain('code-foreground-colored');
    });

    // Consecutive codes do not affect previous ones
    await assertMultipleSequenceElements(
      '\x1b[1mbold\x1b[32mgreen\x1b[4munderline\x1b[3mitalic\x1b[0mnothing',
      [
        (bold) => {
          expect(bold.classList.length).toStrictEqual(1);
          expect(bold.classList).toContain('code-bold'); // 'Bold class not found after bold ANSI code.'
        },
        (green) => {
          expect(green.classList.length).toStrictEqual(2);
          expect(green.classList).toContain('code-bold'); // 'Bold class not found after both bold and color ANSI codes.'
          expect(green.classList).toContain('code-foreground-colored'); // 'Color class not found after color ANSI code.'
        },
        (underline) => {
          expect(underline.classList.length).toStrictEqual(3);
          // 'Bold class not found after bold, color, and underline ANSI codes.',
          expect(underline.classList).toContain('code-bold');
          // 'Color class not found after color and underline ANSI codes.',
          expect(underline.classList).toContain('code-foreground-colored');
          // 'Underline class not found after underline ANSI code.',
          expect(underline.classList).toContain('code-underline');
        },
        (italic) => {
          expect(italic.classList.length).toStrictEqual(4);
          // 'Bold class not found after bold, color, underline, and italic ANSI codes.',
          expect(italic.classList).toContain('code-bold');
          // 'Color class not found after color, underline, and italic ANSI codes.',
          expect(italic.classList).toContain('code-foreground-colored');
          // 'Underline class not found after underline and italic ANSI codes.',
          expect(italic.classList).toContain('code-underline');
          expect(italic.classList).toContain('code-italic'); // 'Italic class not found after italic ANSI code.'
        },
        (nothing) => {
          // One or more style classes still found after reset ANSI code.
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      5,
    );

    // Consecutive codes with ENDING/OFF codes do not LEAVE affect previous ones
    await assertMultipleSequenceElements(
      '\x1b[1mbold\x1b[22m\x1b[32mgreen\x1b[4munderline\x1b[24m\x1b[3mitalic\x1b[23mjustgreen\x1b[0mnothing',
      [
        (bold) => {
          expect(bold.classList.length).toStrictEqual(1);
          expect(bold.classList).toContain('code-bold'); // 'Bold class not found after bold ANSI code.'
        },
        (green) => {
          expect(green.classList.length).toStrictEqual(1);
          assert(
            green.classList.contains('code-bold') === false,
            'Bold class found after both bold WAS TURNED OFF with 22m',
          );
          expect(green.classList).toContain('code-foreground-colored'); // 'Color class not found after color ANSI code.'
        },
        (underline) => {
          expect(underline.classList.length).toStrictEqual(2);
          assert(
            underline.classList.contains('code-foreground-colored'),
            'Color class not found after color and underline ANSI codes.',
          );
          assert(
            underline.classList.contains('code-underline'),
            'Underline class not found after underline ANSI code.',
          );
        },
        (italic) => {
          expect(italic.classList.length).toStrictEqual(2);
          assert(
            italic.classList.contains('code-foreground-colored'),
            'Color class not found after color, underline, and italic ANSI codes.',
          );
          assert(
            italic.classList.contains('code-underline') === false,
            'Underline class found after underline WAS TURNED OFF with 24m',
          );
          expect(italic.classList).toContain('code-italic'); // 'Italic class not found after italic ANSI code.'
        },
        (justgreen) => {
          expect(justgreen.classList.length).toStrictEqual(1);
          assert(
            justgreen.classList.contains('code-italic') === false,
            'Italic class found after italic WAS TURNED OFF with 23m',
          );
          assert(
            justgreen.classList.contains('code-foreground-colored'),
            'Color class not found after color ANSI code.',
          );
        },
        (nothing) => {
          // One or more style classes still found after reset ANSI code.
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // more Consecutive codes with ENDING/OFF codes do not LEAVE affect previous ones
    await assertMultipleSequenceElements(
      '\x1b[2mdim\x1b[22m\x1b[32mgreen\x1b[5mslowblink\x1b[25m\x1b[6mrapidblink\x1b[25mjustgreen\x1b[0mnothing',
      [
        (dim) => {
          expect(dim.classList.length).toStrictEqual(1);
          expect(dim.classList).toContain('code-dim'); // 'Dim class not found after dim ANSI code 2m.'
        },
        (green) => {
          expect(green.classList.length).toStrictEqual(1);
          // 'Dim class found after dim WAS TURNED OFF with 22m'
          expect(green.classList).not.toContain('code-dim');
          expect(green.classList).toContain('code-foreground-colored'); // 'Color class not found after color ANSI code.'
        },
        (slowblink) => {
          expect(slowblink.classList.length).toStrictEqual(2);
          assert(
            slowblink.classList.contains('code-foreground-colored'),
            'Color class not found after color and blink ANSI codes.',
          );
          expect(slowblink.classList).toContain('code-blink'); // 'Blink class not found after underline ANSI code 5m.'
        },
        (rapidblink) => {
          expect(rapidblink.classList.length).toStrictEqual(2);
          assert(
            rapidblink.classList.contains('code-foreground-colored'),
            'Color class not found after color, blink, and rapid blink ANSI codes.',
          );
          assert(
            rapidblink.classList.contains('code-blink') === false,
            'blink class found after underline WAS TURNED OFF with 25m',
          );
          assert(
            rapidblink.classList.contains('code-rapid-blink'),
            'Rapid blink class not found after rapid blink ANSI code 6m.',
          );
        },
        (justgreen) => {
          expect(justgreen.classList.length).toStrictEqual(1);
          assert(
            justgreen.classList.contains('code-rapid-blink') === false,
            'Rapid blink class found after rapid blink WAS TURNED OFF with 25m',
          );
          assert(
            justgreen.classList.contains('code-foreground-colored'),
            'Color class not found after color ANSI code.',
          );
        },
        (nothing) => {
          // One or more style classes still found after reset ANSI code.
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // more Consecutive codes with ENDING/OFF codes do not LEAVE affect previous ones
    await assertMultipleSequenceElements(
      '\x1b[8mhidden\x1b[28m\x1b[32mgreen\x1b[9mcrossedout\x1b[29m\x1b[21mdoubleunderline\x1b[24mjustgreen\x1b[0mnothing',
      [
        (hidden) => {
          expect(hidden.classList.length).toStrictEqual(1);
          expect(hidden.classList).toContain('code-hidden'); // 'Hidden class not found after dim ANSI code 8m.'
        },
        (green) => {
          expect(green.classList.length).toStrictEqual(1);
          assert(
            green.classList.contains('code-hidden') === false,
            'Hidden class found after Hidden WAS TURNED OFF with 28m',
          );
          expect(green.classList).toContain('code-foreground-colored'); // 'Color class not found after color ANSI code.'
        },
        (crossedout) => {
          expect(crossedout.classList.length).toStrictEqual(2);
          assert(
            crossedout.classList.contains('code-foreground-colored'),
            'Color class not found after color and hidden ANSI codes.',
          );
          assert(
            crossedout.classList.contains('code-strike-through'),
            'strike-through class not found after crossout/strikethrough ANSI code 9m.',
          );
        },
        (doubleunderline) => {
          expect(doubleunderline.classList.length).toStrictEqual(2);
          assert(
            doubleunderline.classList.contains('code-foreground-colored'),
            'Color class not found after color, hidden, and crossedout ANSI codes.',
          );
          assert(
            doubleunderline.classList.contains('code-strike-through') === false,
            'strike-through class found after strike-through WAS TURNED OFF with 29m',
          );
          assert(
            doubleunderline.classList.contains('code-double-underline'),
            'Double underline class not found after double underline ANSI code 21m.',
          );
        },
        (justgreen) => {
          expect(justgreen.classList.length).toStrictEqual(1);
          assert(
            justgreen.classList.contains('code-double-underline') === false,
            'Double underline class found after double underline WAS TURNED OFF with 24m',
          );
          assert(
            justgreen.classList.contains('code-foreground-colored'),
            'Color class not found after color ANSI code.',
          );
        },
        (nothing) => {
          // One or more style classes still found after reset ANSI code.
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // underline, double underline are mutually exclusive, test underline->double underline->off and double underline->underline->off
    await assertMultipleSequenceElements(
      '\x1b[4munderline\x1b[21mdouble underline\x1b[24munderlineOff\x1b[21mdouble underline\x1b[4munderline\x1b[24munderlineOff',
      [
        (underline) => {
          expect(underline.classList.length).toStrictEqual(1);
          assert(
            underline.classList.contains('code-underline'),
            'Underline class not found after underline ANSI code 4m.',
          );
        },
        (doubleunderline) => {
          assert(
            doubleunderline.classList.contains('code-underline') === false,
            'Underline class found after double underline code 21m',
          );
          assert(
            doubleunderline.classList.contains('code-double-underline'),
            'Double underline class not found after double underline code 21m',
          );
          expect(doubleunderline.classList.length).toStrictEqual(1); // 'should have found only double underline'
        },
        (nothing) => {
          // One or more style classes still found after underline off code 4m.
          expect(nothing.classList.length).toStrictEqual(0);
        },
        (doubleunderline) => {
          assert(
            doubleunderline.classList.contains('code-double-underline'),
            'Double underline class not found after double underline code 21m',
          );
          expect(doubleunderline.classList.length).toStrictEqual(1); // 'should have found only double underline'
        },
        (underline) => {
          assert(
            underline.classList.contains('code-double-underline') === false,
            'Double underline class found after underline code 4m',
          );
          assert(
            underline.classList.contains('code-underline'),
            'Underline class not found after underline ANSI code 4m.',
          );
          expect(underline.classList.length).toStrictEqual(1); // 'should have found only underline'
        },
        (nothing) => {
          // 'One or more style classes still found after underline off code 4m.',
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // underline and strike-through and overline can exist at the same time and
    // in any combination
    await assertMultipleSequenceElements(
      '\x1b[4munderline\x1b[9mand strikethough\x1b[53mand overline\x1b[24munderlineOff\x1b[55moverlineOff\x1b[29mstriklethoughOff',
      [
        (underline) => {
          expect(underline.classList.length).toStrictEqual(1); // 'should have found only underline'
          assert(
            underline.classList.contains('code-underline'),
            'Underline class not found after underline ANSI code 4m.',
          );
        },
        (strikethrough) => {
          assert(
            strikethrough.classList.contains('code-underline'),
            'Underline class NOT found after strikethrough code 9m',
          );
          assert(
            strikethrough.classList.contains('code-strike-through'),
            'Strike through class not found after strikethrough code 9m',
          );
          expect(strikethrough.classList.length).toStrictEqual(2); // 'should have found underline and strikethrough'
        },
        (overline) => {
          expect(overline.classList).toContain('code-underline'); // 'Underline class NOT found after overline code 53m'
          assert(
            overline.classList.contains('code-strike-through'),
            'Strike through class not found after overline code 53m',
          );
          expect(overline.classList).toContain('code-overline'); // 'Overline class not found after overline code 53m'
          expect(overline.classList.length).toStrictEqual(3); // 'should have found underline,strikethrough and overline'
        },
        (underlineoff) => {
          assert(
            underlineoff.classList.contains('code-underline') === false,
            'Underline class found after underline off code 24m',
          );
          assert(
            underlineoff.classList.contains('code-strike-through'),
            'Strike through class not found after underline off code 24m',
          );
          assert(
            underlineoff.classList.contains('code-overline'),
            'Overline class not found after underline off code 24m',
          );
          expect(underlineoff.classList.length).toStrictEqual(2); // 'should have found strikethrough and overline'
        },
        (overlineoff) => {
          assert(
            overlineoff.classList.contains('code-underline') === false,
            'Underline class found after overline off code 55m',
          );
          assert(
            overlineoff.classList.contains('code-overline') === false,
            'Overline class found after overline off code 55m',
          );
          assert(
            overlineoff.classList.contains('code-strike-through'),
            'Strike through class not found after overline off code 55m',
          );
          expect(overlineoff.classList.length).toStrictEqual(1); // 'should have found only strikethrough'
        },
        (nothing) => {
          assert(
            nothing.classList.contains('code-strike-through') === false,
            'Strike through class found after strikethrough off code 29m',
          );
          // 'One or more style classes still found after strikethough OFF code 29m',
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // double underline and strike-through and overline can exist at the same time and
    // in any combination
    await assertMultipleSequenceElements(
      '\x1b[21mdoubleunderline\x1b[9mand strikethough\x1b[53mand overline\x1b[29mstriklethoughOff\x1b[55moverlineOff\x1b[24munderlineOff',
      [
        (doubleunderline) => {
          expect(doubleunderline.classList.length).toStrictEqual(1); // 'should have found only doubleunderline'
          assert(
            doubleunderline.classList.contains('code-double-underline'),
            'Double underline class not found after double underline ANSI code 21m.',
          );
        },
        (strikethrough) => {
          assert(
            strikethrough.classList.contains('code-double-underline'),
            'Double nderline class NOT found after strikethrough code 9m',
          );
          assert(
            strikethrough.classList.contains('code-strike-through'),
            'Strike through class not found after strikethrough code 9m',
          );
          expect(strikethrough.classList.length).toStrictEqual(2); // 'should have found doubleunderline and strikethrough'
        },
        (overline) => {
          assert(
            overline.classList.contains('code-double-underline'),
            'Double underline class NOT found after overline code 53m',
          );
          assert(
            overline.classList.contains('code-strike-through'),
            'Strike through class not found after overline code 53m',
          );
          expect(overline.classList).toContain('code-overline'); // 'Overline class not found after overline code 53m'
          // 'should have found doubleunderline,overline and strikethrough',
          expect(overline.classList.length).toStrictEqual(3);
        },
        (strikethrougheoff) => {
          assert(
            strikethrougheoff.classList.contains('code-double-underline'),
            'Double underline class NOT found after strikethrough off code 29m',
          );
          assert(
            strikethrougheoff.classList.contains('code-overline'),
            'Overline class NOT found after strikethrough off code 29m',
          );
          assert(
            strikethrougheoff.classList.contains('code-strike-through') === false,
            'Strike through class found after strikethrough off code 29m',
          );
          expect(strikethrougheoff.classList.length).toStrictEqual(2); // 'should have found doubleunderline and overline'
        },
        (overlineoff) => {
          assert(
            overlineoff.classList.contains('code-double-underline'),
            'Double underline class NOT found after overline off code 55m',
          );
          assert(
            overlineoff.classList.contains('code-strike-through') === false,
            'Strike through class found after overline off code 55m',
          );
          assert(
            overlineoff.classList.contains('code-overline') === false,
            'Overline class found after overline off code 55m',
          );
          expect(overlineoff.classList.length).toStrictEqual(1); // 'Should have found only double underline'
        },
        (nothing) => {
          assert(
            nothing.classList.contains('code-double-underline') === false,
            'Double underline class found after underline off code 24m',
          );
          // 'One or more style classes still found after underline OFF code 24m',
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // superscript and subscript are mutually exclusive, test superscript->subscript->off and subscript->superscript->off
    await assertMultipleSequenceElements(
      '\x1b[73msuperscript\x1b[74msubscript\x1b[75mneither\x1b[74msubscript\x1b[73msuperscript\x1b[75mneither',
      [
        (superscript) => {
          expect(superscript.classList.length).toStrictEqual(1); // 'should only be superscript class'
          assert(
            superscript.classList.contains('code-superscript'),
            'Superscript class not found after superscript ANSI code 73m.',
          );
        },
        (subscript) => {
          assert(
            subscript.classList.contains('code-superscript') === false,
            'Superscript class found after subscript code 74m',
          );
          expect(subscript.classList).toContain('code-subscript'); // 'Subscript class not found after subscript code 74m'
          expect(subscript.classList.length).toStrictEqual(1); // 'should have found only subscript class'
        },
        (nothing) => {
          // 'One or more style classes still found after superscript/subscript off code 75m.',
          expect(nothing.classList.length).toStrictEqual(0);
        },
        (subscript) => {
          expect(subscript.classList).toContain('code-subscript'); // 'Subscript class not found after subscript code 74m'
          expect(subscript.classList.length).toStrictEqual(1); // 'should have found only subscript class'
        },
        (superscript) => {
          assert(
            superscript.classList.contains('code-subscript') === false,
            'Subscript class found after superscript code 73m',
          );
          assert(
            superscript.classList.contains('code-superscript'),
            'Superscript class not found after superscript ANSI code 73m.',
          );
          expect(superscript.classList.length).toStrictEqual(1); // 'should have found only superscript class'
        },
        (nothing) => {
          // 'One or more style classes still found after superscipt/subscript off code 75m.',
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // Consecutive font codes switch to new font class and remove previous and then final switch to default font removes class
    await assertMultipleSequenceElements(
      '\x1b[11mFont1\x1b[12mFont2\x1b[13mFont3\x1b[14mFont4\x1b[15mFont5\x1b[10mdefaultFont',
      [
        (font1) => {
          expect(font1.classList.length).toStrictEqual(1);
          assert(
            font1.classList.contains('code-font-1'),
            'font 1 class NOT found after switch to font 1 with ANSI code 11m',
          );
        },
        (font2) => {
          expect(font2.classList.length).toStrictEqual(1);
          assert(
            font2.classList.contains('code-font-1') === false,
            'font 1 class found after switch to font 2 with ANSI code 12m',
          );
          assert(
            font2.classList.contains('code-font-2'),
            'font 2 class NOT found after switch to font 2 with ANSI code 12m',
          );
        },
        (font3) => {
          expect(font3.classList.length).toStrictEqual(1);
          assert(
            font3.classList.contains('code-font-2') === false,
            'font 2 class found after switch to font 3 with ANSI code 13m',
          );
          assert(
            font3.classList.contains('code-font-3'),
            'font 3 class NOT found after switch to font 3 with ANSI code 13m',
          );
        },
        (font4) => {
          expect(font4.classList.length).toStrictEqual(1);
          assert(
            font4.classList.contains('code-font-3') === false,
            'font 3 class found after switch to font 4 with ANSI code 14m',
          );
          assert(
            font4.classList.contains('code-font-4'),
            'font 4 class NOT found after switch to font 4 with ANSI code 14m',
          );
        },
        (font5) => {
          expect(font5.classList.length).toStrictEqual(1);
          assert(
            font5.classList.contains('code-font-4') === false,
            'font 4 class found after switch to font 5 with ANSI code 15m',
          );
          assert(
            font5.classList.contains('code-font-5'),
            'font 5 class NOT found after switch to font 5 with ANSI code 15m',
          );
        },
        (defaultfont) => {
          // 'One or more font style classes still found after reset to default font with ANSI code 10m.',
          expect(defaultfont.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // More Consecutive font codes switch to new font class and remove previous and then final switch to default font removes class
    await assertMultipleSequenceElements(
      '\x1b[16mFont6\x1b[17mFont7\x1b[18mFont8\x1b[19mFont9\x1b[20mFont10\x1b[10mdefaultFont',
      [
        (font6) => {
          expect(font6.classList.length).toStrictEqual(1);
          assert(
            font6.classList.contains('code-font-6'),
            'font 6 class NOT found after switch to font 6 with ANSI code 16m',
          );
        },
        (font7) => {
          expect(font7.classList.length).toStrictEqual(1);
          assert(
            font7.classList.contains('code-font-6') === false,
            'font 6 class found after switch to font 7 with ANSI code 17m',
          );
          assert(
            font7.classList.contains('code-font-7'),
            'font 7 class NOT found after switch to font 7 with ANSI code 17m',
          );
        },
        (font8) => {
          expect(font8.classList.length).toStrictEqual(1);
          assert(
            font8.classList.contains('code-font-7') === false,
            'font 7 class found after switch to font 8 with ANSI code 18m',
          );
          assert(
            font8.classList.contains('code-font-8'),
            'font 8 class NOT found after switch to font 8 with ANSI code 18m',
          );
        },
        (font9) => {
          expect(font9.classList.length).toStrictEqual(1);
          assert(
            font9.classList.contains('code-font-8') === false,
            'font 8 class found after switch to font 9 with ANSI code 19m',
          );
          assert(
            font9.classList.contains('code-font-9'),
            'font 9 class NOT found after switch to font 9 with ANSI code 19m',
          );
        },
        (font10) => {
          expect(font10.classList.length).toStrictEqual(1);
          assert(
            font10.classList.contains('code-font-9') === false,
            'font 9 class found after switch to font 10 with ANSI code 20m',
          );
          assert(
            font10.classList.contains('code-font-10'),
            `font 10 class NOT found after switch to font 10 with ANSI code 20m (${font10.classList})`,
          );
        },
        (defaultfont) => {
          // 'One or more font style classes (2nd series) still found after reset to default font with ANSI code 10m.',
          expect(defaultfont.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // Blackletter font codes can be turned off with other font codes or 23m
    await assertMultipleSequenceElements(
      '\x1b[3mitalic\x1b[20mfont10blacklatter\x1b[23mitalicAndBlackletterOff\x1b[20mFont10Again\x1b[11mFont1\x1b[10mdefaultFont',
      [
        (italic) => {
          expect(italic.classList.length).toStrictEqual(1);
          expect(italic.classList).toContain('code-italic'); // 'italic class NOT found after italic code ANSI code 3m'
        },
        (font10) => {
          expect(font10.classList.length).toStrictEqual(2);
          assert(
            font10.classList.contains('code-italic'),
            'no itatic class found after switch to font 10 (blackletter) with ANSI code 20m',
          );
          assert(
            font10.classList.contains('code-font-10'),
            'font 10 class NOT found after switch to font 10 with ANSI code 20m',
          );
        },
        (italicAndBlackletterOff) => {
          // 'italic or blackletter (font10) class found after both switched off with ANSI code 23m',
          expect(italicAndBlackletterOff.classList.length).toStrictEqual(0);
        },
        (font10) => {
          expect(font10.classList.length).toStrictEqual(1);
          assert(
            font10.classList.contains('code-font-10'),
            'font 10 class NOT found after switch to font 10 with ANSI code 20m',
          );
        },
        (font1) => {
          expect(font1.classList.length).toStrictEqual(1);
          assert(
            font1.classList.contains('code-font-10') === false,
            'font 10 class found after switch to font 1 with ANSI code 11m',
          );
          assert(
            font1.classList.contains('code-font-1'),
            'font 1 class NOT found after switch to font 1 with ANSI code 11m',
          );
        },
        (defaultfont) => {
          // 'One or more font style classes (2nd series) still found after reset to default font with ANSI code 10m.',
          expect(defaultfont.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // italic can be turned on/off with affecting font codes 1-9  (italic off will clear 'blackletter'(font 23) as per spec)
    await assertMultipleSequenceElements(
      '\x1b[3mitalic\x1b[12mfont2\x1b[23mitalicOff\x1b[3mitalicFont2\x1b[10mjustitalic\x1b[23mnothing',
      [
        (italic) => {
          expect(italic.classList.length).toStrictEqual(1);
          expect(italic.classList).toContain('code-italic'); // 'italic class NOT found after italic code ANSI code 3m'
        },
        (font10) => {
          expect(font10.classList.length).toStrictEqual(2);
          assert(
            font10.classList.contains('code-italic'),
            'no itatic class found after switch to font 2 with ANSI code 12m',
          );
          assert(
            font10.classList.contains('code-font-2'),
            'font 2 class NOT found after switch to font 2 with ANSI code 12m',
          );
        },
        (italicOff) => {
          // 'italic class found after both switched off with ANSI code 23m',
          expect(italicOff.classList.length).toStrictEqual(1);

          assert(
            italicOff.classList.contains('code-italic') === false,
            'itatic class found after switching it OFF with ANSI code 23m',
          );
          assert(
            italicOff.classList.contains('code-font-2'),
            'font 2 class NOT found after switching italic off with ANSI code 23m',
          );
        },
        (italicFont2) => {
          expect(italicFont2.classList.length).toStrictEqual(2);
          expect(italicFont2.classList).toContain('code-italic'); // 'no itatic class found after italic ANSI code 3m'
          expect(italicFont2.classList).toContain('code-font-2'); // 'font 2 class NOT found after italic ANSI code 3m'
        },
        (justitalic) => {
          expect(justitalic.classList.length).toStrictEqual(1);
          assert(
            justitalic.classList.contains('code-font-2') === false,
            'font 2 class found after switch to default font with ANSI code 10m',
          );
          assert(
            justitalic.classList.contains('code-italic'),
            'italic class NOT found after switch to default font with ANSI code 10m',
          );
        },
        (nothing) => {
          // 'One or more classes still found after final italic removal with ANSI code 23m.',
          expect(nothing.classList.length).toStrictEqual(0);
        },
      ],
      6,
    );

    // Reverse video reverses Foreground/Background colors WITH both SET and can called in sequence
    await assertMultipleSequenceElements(
      '\x1b[38;2;10;20;30mfg10,20,30\x1b[48;2;167;168;169mbg167,168,169\x1b[7m8ReverseVideo\x1b[7mDuplicateReverseVideo\x1b[27mReverseOff\x1b[27mDupReverseOff',
      [
        (fg10_20_30) => {
          expect(fg10_20_30.classList.length).toStrictEqual(1); // 'Foreground ANSI color code should add one class.'
          assert(
            fg10_20_30.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            fg10_20_30,
            'foreground',
            new RGBA(10, 20, 30),
            '24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
        (bg167_168_169) => {
          // 'background ANSI color codes should only add a single class.',
          expect(bg167_168_169.classList.length).toStrictEqual(2);

          assert(
            bg167_168_169.classList.contains('code-background-colored'),
            'Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            bg167_168_169,
            'background',
            new RGBA(167, 168, 169),
            '24-bit RGBA ANSI background color code (167,168,169) should add matching color inline style.',
          );
          assert(
            bg167_168_169.classList.contains('code-foreground-colored'),
            'Still Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            bg167_168_169,
            'foreground',
            new RGBA(10, 20, 30),
            'Still 24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
        (reverseVideo) => {
          // 'background ANSI color codes should only add a single class.',
          expect(reverseVideo.classList.length).toStrictEqual(2);
          assert(
            reverseVideo.classList.contains('code-background-colored'),
            'Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            reverseVideo,
            'foreground',
            new RGBA(167, 168, 169),
            'Reversed 24-bit RGBA ANSI foreground color code (167,168,169) should add matching former background color inline style.',
          );
          assert(
            reverseVideo.classList.contains('code-foreground-colored'),
            'Still Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            reverseVideo,
            'background',
            new RGBA(10, 20, 30),
            'Reversed 24-bit RGBA ANSI background color code (10,20,30) should add matching former foreground color inline style.',
          );
        },
        (dupReverseVideo) => {
          // 'After second Reverse Video - background ANSI color codes should only add a single class.',
          expect(dupReverseVideo.classList.length).toStrictEqual(2);
          assert(
            dupReverseVideo.classList.contains('code-background-colored'),
            'After second Reverse Video - Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            dupReverseVideo,
            'foreground',
            new RGBA(167, 168, 169),
            'After second Reverse Video - Reversed 24-bit RGBA ANSI foreground color code (167,168,169) should add matching former background color inline style.',
          );
          assert(
            dupReverseVideo.classList.contains('code-foreground-colored'),
            'After second Reverse Video - Still Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            dupReverseVideo,
            'background',
            new RGBA(10, 20, 30),
            'After second Reverse Video - Reversed 24-bit RGBA ANSI background color code (10,20,30) should add matching former foreground color inline style.',
          );
        },
        (reversedBack) => {
          // 'Reversed Back - background ANSI color codes should only add a single class.',
          expect(reversedBack.classList.length).toStrictEqual(2);
          assert(
            reversedBack.classList.contains('code-background-colored'),
            'Reversed Back - Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            reversedBack,
            'background',
            new RGBA(167, 168, 169),
            'Reversed Back - 24-bit RGBA ANSI background color code (167,168,169) should add matching color inline style.',
          );
          assert(
            reversedBack.classList.contains('code-foreground-colored'),
            'Reversed Back -  Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            reversedBack,
            'foreground',
            new RGBA(10, 20, 30),
            'Reversed Back -  24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
        (dupReversedBack) => {
          // '2nd Reversed Back - background ANSI color codes should only add a single class.',
          expect(dupReversedBack.classList.length).toStrictEqual(2);

          assert(
            dupReversedBack.classList.contains('code-background-colored'),
            '2nd Reversed Back - Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            dupReversedBack,
            'background',
            new RGBA(167, 168, 169),
            '2nd Reversed Back - 24-bit RGBA ANSI background color code (167,168,169) should add matching color inline style.',
          );
          assert(
            dupReversedBack.classList.contains('code-foreground-colored'),
            '2nd Reversed Back -  Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            dupReversedBack,
            'foreground',
            new RGBA(10, 20, 30),
            '2nd Reversed Back -  24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
      ],
      6,
    );

    // Reverse video reverses Foreground/Background colors WITH ONLY foreground color SET
    await assertMultipleSequenceElements(
      '\x1b[38;2;10;20;30mfg10,20,30\x1b[7m8ReverseVideo\x1b[27mReverseOff',
      [
        (fg10_20_30) => {
          expect(fg10_20_30.classList.length).toStrictEqual(1); // 'Foreground ANSI color code should add one class.'
          assert(
            fg10_20_30.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            fg10_20_30,
            'foreground',
            new RGBA(10, 20, 30),
            '24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
        (reverseVideo) => {
          // 'Background ANSI color codes should only add a single class.',
          expect(reverseVideo.classList.length).toStrictEqual(1);

          assert(
            reverseVideo.classList.contains('code-background-colored'),
            'Background ANSI color codes should add custom background color class.',
          );
          assert(
            reverseVideo.classList.contains('code-foreground-colored') === false,
            'After Reverse with NO background the Foreground ANSI color codes should NOT BE SET.',
          );
          assertInlineColor(
            reverseVideo,
            'background',
            new RGBA(10, 20, 30),
            'Reversed 24-bit RGBA ANSI background color code (10,20,30) should add matching former foreground color inline style.',
          );
        },
        (reversedBack) => {
          // 'Reversed Back - background ANSI color codes should only add a single class.',
          expect(reversedBack.classList.length).toStrictEqual(1);

          assert(
            reversedBack.classList.contains('code-background-colored') === false,
            'AFTER Reversed Back - Background ANSI color should NOT BE SET.',
          );
          assert(
            reversedBack.classList.contains('code-foreground-colored'),
            'Reversed Back -  Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            reversedBack,
            'foreground',
            new RGBA(10, 20, 30),
            'Reversed Back -  24-bit RGBA ANSI color code (10,20,30) should add matching color inline style.',
          );
        },
      ],
      3,
    );

    // Reverse video reverses Foreground/Background colors WITH ONLY background color SET
    await assertMultipleSequenceElements(
      '\x1b[48;2;167;168;169mbg167,168,169\x1b[7m8ReverseVideo\x1b[27mReverseOff',
      [
        (bg167_168_169) => {
          expect(bg167_168_169.classList.length).toStrictEqual(1); // 'Background ANSI color code should add one class.'
          assert(
            bg167_168_169.classList.contains('code-background-colored'),
            'Background ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            bg167_168_169,
            'background',
            new RGBA(167, 168, 169),
            '24-bit RGBA ANSI color code (167, 168, 169) should add matching background color inline style.',
          );
        },
        (reverseVideo) => {
          // 'After ReverseVideo Foreground ANSI color codes should only add a single class.',
          expect(reverseVideo.classList.length).toStrictEqual(1);

          assert(
            reverseVideo.classList.contains('code-foreground-colored'),
            'After ReverseVideo Foreground ANSI color codes should add custom background color class.',
          );
          assert(
            reverseVideo.classList.contains('code-background-colored') === false,
            'After Reverse with NO foreground color the background ANSI color codes should BE SET.',
          );
          assertInlineColor(
            reverseVideo,
            'foreground',
            new RGBA(167, 168, 169),
            'Reversed 24-bit RGBA ANSI background color code (10,20,30) should add matching former background color inline style.',
          );
        },
        (reversedBack) => {
          // 'Reversed Back - background ANSI color codes should only add a single class.',
          expect(reversedBack.classList.length).toStrictEqual(1);

          assert(
            reversedBack.classList.contains('code-foreground-colored') === false,
            'AFTER Reversed Back - Foreground ANSI color should NOT BE SET.',
          );
          assert(
            reversedBack.classList.contains('code-background-colored'),
            'Reversed Back -  Background ANSI color codes should add custom background color class.',
          );
          assertInlineColor(
            reversedBack,
            'background',
            new RGBA(167, 168, 169),
            'Reversed Back -  24-bit RGBA ANSI color code (10,20,30) should add matching background color inline style.',
          );
        },
      ],
      3,
    );

    // Underline color Different types of color codes still cancel each other
    await assertMultipleSequenceElements(
      '\x1b[58;2;101;102;103m24bitUnderline101,102,103\x1b[58;5;3m8bitsimpleUnderline\x1b[58;2;104;105;106m24bitUnderline104,105,106\x1b[58;5;101m8bitadvanced\x1b[58;2;200;200;200munderline200,200,200\x1b[59mUnderlineColorResetToDefault',
      [
        (adv24Bit) => {
          // 'Underline ANSI color codes should only add a single class (1).',
          expect(adv24Bit.classList.length).toStrictEqual(1);
          assert(
            adv24Bit.classList.contains('code-underline-colored'),
            'Underline ANSI color codes should add custom underline color class.',
          );
          assertInlineColor(
            adv24Bit,
            'underline',
            new RGBA(101, 102, 103),
            '24-bit RGBA ANSI color code (101,102,103) should add matching color inline style.',
          );
        },
        (adv8BitSimple) => {
          // 'Multiple underline ANSI color codes should only add a single class (2).',
          expect(adv8BitSimple.classList.length).toStrictEqual(1);

          assert(
            adv8BitSimple.classList.contains('code-underline-colored'),
            'Underline ANSI color codes should add custom underline color class.',
          );
          // changed to simple theme color, don't know exactly what it should be, but it should NO LONGER BE 101,102,103
          assertInlineColor(
            adv8BitSimple,
            'underline',
            new RGBA(101, 102, 103),
            'Change to theme color SHOULD NOT STILL BE 24-bit RGBA ANSI color code (101,102,103) should add matching color inline style.',
            false,
          );
        },
        (adv24BitAgain) => {
          // 'Multiple underline ANSI color codes should only add a single class (3).',
          expect(adv24BitAgain.classList.length).toStrictEqual(1);
          assert(
            adv24BitAgain.classList.contains('code-underline-colored'),
            'Underline ANSI color codes should add custom underline color class.',
          );
          assertInlineColor(
            adv24BitAgain,
            'underline',
            new RGBA(104, 105, 106),
            '24-bit RGBA ANSI color code (100,100,100) should add matching color inline style.',
          );
        },
        (adv8BitAdvanced) => {
          // 'Multiple underline ANSI color codes should only add a single class (4).',
          expect(adv8BitAdvanced.classList.length).toStrictEqual(1);
          assert(
            adv8BitAdvanced.classList.contains('code-underline-colored'),
            'Underline ANSI color codes should add custom underline color class.',
          );
          // changed to 8bit advanced color, don't know exactly what it should be, but it should NO LONGER BE 104,105,106
          assertInlineColor(
            adv8BitAdvanced,
            'underline',
            new RGBA(104, 105, 106),
            'Change to theme color SHOULD NOT BE 24-bit RGBA ANSI color code (104,105,106) should add matching color inline style.',
            false,
          );
        },
        (adv24BitUnderlin200) => {
          // 'Multiple underline ANSI color codes should only add a single class 4.',
          expect(adv24BitUnderlin200.classList.length).toStrictEqual(1);

          assert(
            adv24BitUnderlin200.classList.contains('code-underline-colored'),
            'Underline ANSI color codes should add custom underline color class.',
          );
          assertInlineColor(
            adv24BitUnderlin200,
            'underline',
            new RGBA(200, 200, 200),
            'after change underline color SHOULD BE 24-bit RGBA ANSI color code (200,200,200) should add matching color inline style.',
          );
        },
        (underlineColorResetToDefault) => {
          // 'After Underline Color reset to default NO underline color class should be set.',
          expect(underlineColorResetToDefault.classList.length).toStrictEqual(0);
          assertInlineColor(
            underlineColorResetToDefault,
            'underline',
            undefined,
            'after RESET TO DEFAULT underline color SHOULD NOT BE SET (no color inline style.)',
          );
        },
      ],
      6,
    );

    // Different types of color codes still cancel each other
    await assertMultipleSequenceElements(
      '\x1b[34msimple\x1b[38;2;101;102;103m24bit\x1b[38;5;3m8bitsimple\x1b[38;2;104;105;106m24bitAgain\x1b[38;5;101m8bitadvanced',
      [
        (simple) => {
          expect(simple.classList.length).toStrictEqual(1); // 'Foreground ANSI color code should add one class.'
          assert(
            simple.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
        },
        (adv24Bit) => {
          // 'Multiple foreground ANSI color codes should only add a single class.',
          expect(adv24Bit.classList.length).toStrictEqual(1);

          assert(
            adv24Bit.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            adv24Bit,
            'foreground',
            new RGBA(101, 102, 103),
            '24-bit RGBA ANSI color code (101,102,103) should add matching color inline style.',
          );
        },
        (adv8BitSimple) => {
          // 'Multiple foreground ANSI color codes should only add a single class.',
          expect(adv8BitSimple.classList.length).toStrictEqual(1);
          assert(
            adv8BitSimple.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          // color is theme based, so we can't check what it should be but we know it should NOT BE 101,102,103 anymore
          assertInlineColor(
            adv8BitSimple,
            'foreground',
            new RGBA(101, 102, 103),
            'SHOULD NOT LONGER BE 24-bit RGBA ANSI color code (101,102,103) after simple color change.',
            false,
          );
        },
        (adv24BitAgain) => {
          // 'Multiple foreground ANSI color codes should only add a single class.',
          expect(adv24BitAgain.classList.length).toStrictEqual(1);
          assert(
            adv24BitAgain.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          assertInlineColor(
            adv24BitAgain,
            'foreground',
            new RGBA(104, 105, 106),
            '24-bit RGBA ANSI color code (104,105,106) should add matching color inline style.',
          );
        },
        (adv8BitAdvanced) => {
          // 'Multiple foreground ANSI color codes should only add a single class.'
          expect(adv8BitAdvanced.classList.length).toStrictEqual(1);

          assert(
            adv8BitAdvanced.classList.contains('code-foreground-colored'),
            'Foreground ANSI color codes should add custom foreground color class.',
          );
          // color should NO LONGER BE 104,105,106
          assertInlineColor(
            adv8BitAdvanced,
            'foreground',
            new RGBA(104, 105, 106),
            'SHOULD NOT LONGER BE 24-bit RGBA ANSI color code (104,105,106) after advanced color change.',
            false,
          );
        },
      ],
      5,
    );
  });

  /**
   * Assert that the provided ANSI sequence exactly matches the text content of the resulting
   * {@link HTMLSpanElement}.
   *
   * @param sequence The ANSI sequence to verify.
   */
  async function assertSequencestrictEqualToContent(sequence: string): Promise<void> {
    const child: HTMLSpanElement = await getSequenceOutput(sequence);
    assert(child.textContent === sequence);
  }

  test('Invalid codes treated as regular text', async () => {
    // Individual components of ANSI code start are printed
    await assertSequencestrictEqualToContent('\x1b');
    await assertSequencestrictEqualToContent('[');

    // Unsupported sequence prints both characters
    await assertSequencestrictEqualToContent('\x1b[');

    // Random strings are displayed properly
    for (let i = 0; i < 50; i++) {
      const uid: string = uuid();
      await assertSequencestrictEqualToContent(uid);
    }
  });

  /**
   * Assert that a given ANSI sequence maintains added content following the ANSI code, and that
   * the expression itself is thrown away.
   *
   * @param sequence The ANSI sequence to verify. The provided sequence should contain ANSI codes
   * only, and should not include actual text content as it is provided by this function.
   */
  async function assertEmptyOutput(sequence: string) {
    const child: HTMLSpanElement = await getSequenceOutput(sequence + 'content');
    expect(child.textContent).toStrictEqual('content');
    expect(child.classList.length).toStrictEqual(0);
  }

  test('Empty sequence output', async () => {
    const sequences: string[] = [
      // No colour codes
      '',
      '\x1b[;m',
      '\x1b[1;;m',
      '\x1b[m',
      '\x1b[99m',
    ];

    for await (const sequence of sequences) {
      await assertEmptyOutput(sequence);
    }

    // Check other possible ANSI terminators
    const terminators: string[] = 'ABCDHIJKfhmpsu'.split('');
    for await (const terminator of terminators) {
      await assertEmptyOutput('\x1b[content' + terminator);
    }
  });

  test('calcANSI8bitColor', () => {
    // Invalid values
    // Negative (below range), simple range, decimals
    for (let i = -10; i <= 15; i += 0.5) {
      // 'Values less than 16 passed to calcANSI8bitColor should return undefined.',
      expect(calcANSI8bitColor(i)).toBeUndefined();
    }
    // In-range range decimals
    for (let i = 16.5; i < 254; i += 1) {
      // 'Floats passed to calcANSI8bitColor should return undefined.'
      expect(calcANSI8bitColor(i)).toBeUndefined();
    }
    // Above range
    for (let i = 256; i < 300; i += 0.5) {
      // 'Values grather than 255 passed to calcANSI8bitColor should return undefined.',
      expect(calcANSI8bitColor(i)).toBeUndefined();
    }

    // All valid colors
    for (let red = 0; red <= 5; red++) {
      for (let green = 0; green <= 5; green++) {
        for (let blue = 0; blue <= 5; blue++) {
          const colorOut: any = calcANSI8bitColor(16 + red * 36 + green * 6 + blue);
          // 'Incorrect red value encountered for color'
          expect(colorOut.r).toStrictEqual(Math.round(red * (255 / 5)));
          // 'Incorrect green value encountered for color'
          expect(colorOut.g).toStrictEqual(Math.round(green * (255 / 5)));
          // 'Incorrect balue value encountered for color'
          expect(colorOut.b).toStrictEqual(Math.round(blue * (255 / 5)));
        }
      }
    }

    // All grays
    for (let i = 232; i <= 255; i++) {
      const grayOut: any = calcANSI8bitColor(i);
      expect(grayOut.r).toStrictEqual(grayOut.g);
      expect(grayOut.r).toStrictEqual(grayOut.b);
      expect(grayOut.r).toStrictEqual(Math.round(((i - 232) / 23) * 255));
    }
  });
});
