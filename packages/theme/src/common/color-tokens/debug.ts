import { registerColor } from '../utils';

import { foreground, errorForeground } from './base';
import { editorInfoForeground, editorWarningForeground } from './editor';

export const debugTokenExpressionName = registerColor(
  'debugTokenExpression.name',
  { dark: '#c586c0', light: '#9b46b0', hcDark: foreground, hcLight: foreground },
  'Foreground color for the token names shown in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionValue = registerColor(
  'debugTokenExpression.value',
  { dark: '#cccccc99', light: '#6c6c6ccc', hcDark: foreground, hcLight: foreground },
  'Foreground color for the token values shown in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionString = registerColor(
  'debugTokenExpression.string',
  { dark: '#ce9178', light: '#a31515', hcDark: '#f48771', hcLight: '#a31515' },
  'Foreground color for strings in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionBoolean = registerColor(
  'debugTokenExpression.boolean',
  { dark: '#4e94ce', light: '#0000ff', hcDark: '#75bdfe', hcLight: '#0000ff' },
  'Foreground color for booleans in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionNumber = registerColor(
  'debugTokenExpression.number',
  { dark: '#b5cea8', light: '#098658', hcDark: '#89d185', hcLight: '#098658' },
  'Foreground color for numbers in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionError = registerColor(
  'debugTokenExpression.error',
  { dark: '#f48771', light: '#e51400', hcDark: '#f48771', hcLight: '#e51400' },
  'Foreground color for expression errors in the debug views (ie. the Variables or Watch view) and for error logs shown in the debug console.',
);

export const debugViewExceptionLabelForeground = registerColor(
  'debugView.exceptionLabelForeground',
  { dark: foreground, light: '#FFF', hcDark: foreground, hcLight: foreground },
  'Foreground color for a label shown in the CALL STACK view when the debugger breaks on an exception.',
);
export const debugViewExceptionLabelBackground = registerColor(
  'debugView.exceptionLabelBackground',
  { dark: '#6C2022', light: '#A31515', hcDark: '#6C2022', hcLight: '#A31515' },
  'Background color for a label shown in the CALL STACK view when the debugger breaks on an exception.',
);
export const debugExceptionWidgetBorder = registerColor(
  'debugExceptionWidget.border',
  { dark: '#a31515', light: '#a31515', hcDark: '#a31515', hcLight: '#a31515' },
  'Exception widget border color.',
);
export const debugExceptionWidgetBackground = registerColor(
  'debugExceptionWidget.background',
  { dark: '#420b0d', light: '#f1dfde', hcDark: '#420b0d', hcLight: '#f1dfde' },
  'Exception widget background color.',
);

export const debugViewStateLabelForeground = registerColor(
  'debugView.stateLabelForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  "Foreground color for a label in the CALL STACK view showing the current session's or thread's state.",
);
export const debugViewStateLabelBackground = registerColor(
  'debugView.stateLabelBackground',
  { dark: '#88888844', light: '#88888844', hcDark: '#88888844', hcLight: '#88888844' },
  "Background color for a label in the CALL STACK view showing the current session's or thread's state.",
);
export const debugViewValueChangedHighlight = registerColor(
  'debugView.valueChangedHighlight',
  { dark: '#569CD6', light: '#569CD6', hcDark: '#569CD6', hcLight: '#569CD6' },
  'Color used to highlight value changes in the debug views (ie. in the Variables view).',
);

export const debugConsoleInfoForeground = registerColor(
  'debugConsole.infoForeground',
  { dark: editorInfoForeground, light: editorInfoForeground, hcDark: foreground, hcLight: foreground },
  'Foreground color for info messages in debug REPL console.',
);
export const debugConsoleWarningForeground = registerColor(
  'debugConsole.warningForeground',
  {
    dark: editorWarningForeground,
    light: editorWarningForeground,
    hcDark: '#008000',
    hcLight: editorWarningForeground,
  },
  'Foreground color for warning messages in debug REPL console.',
);
export const debugConsoleErrorForeground = registerColor(
  'debugConsole.errorForeground',
  { dark: errorForeground, light: errorForeground, hcDark: errorForeground, hcLight: errorForeground },
  'Foreground color for error messages in debug REPL console.',
);
export const debugConsoleSourceForeground = registerColor(
  'debugConsole.sourceForeground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  'Foreground color for source filenames in debug REPL console.',
);
export const debugConsoleInputIconForeground = registerColor(
  'debugConsoleInputIcon.foreground',
  { dark: foreground, light: foreground, hcDark: foreground, hcLight: foreground },
  'Foreground color for debug console input marker icon.',
);
export const debugIconBreakpointForeground = registerColor(
  'debugIcon.breakpointForeground',
  { dark: '#E51400', light: '#E51400', hcDark: '#E51400', hcLight: '#E51400' },
  'Icon color for breakpoints.',
);
