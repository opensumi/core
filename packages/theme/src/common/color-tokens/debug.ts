import { registerColor } from '../color-registry';

import { foreground, errorForeground } from './base';
import { editorInfoForeground, editorWarningForeground } from './editor';

export const debugTokenExpressionName = registerColor(
  'debugTokenExpression.name',
  { dark: '#c586c0', light: '#9b46b0', hc: foreground },
  'Foreground color for the token names shown in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionValue = registerColor(
  'debugTokenExpression.value',
  { dark: '#cccccc99', light: '#6c6c6ccc', hc: foreground },
  'Foreground color for the token values shown in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionString = registerColor(
  'debugTokenExpression.string',
  { dark: '#ce9178', light: '#a31515', hc: '#f48771' },
  'Foreground color for strings in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionBoolean = registerColor(
  'debugTokenExpression.boolean',
  { dark: '#4e94ce', light: '#0000ff', hc: '#75bdfe' },
  'Foreground color for booleans in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionNumber = registerColor(
  'debugTokenExpression.number',
  { dark: '#b5cea8', light: '#098658', hc: '#89d185' },
  'Foreground color for numbers in the debug views (ie. the Variables or Watch view).',
);
export const debugTokenExpressionError = registerColor(
  'debugTokenExpression.error',
  { dark: '#f48771', light: '#e51400', hc: '#f48771' },
  'Foreground color for expression errors in the debug views (ie. the Variables or Watch view) and for error logs shown in the debug console.',
);

export const debugViewExceptionLabelForeground = registerColor(
  'debugView.exceptionLabelForeground',
  { dark: foreground, light: '#FFF', hc: foreground },
  'Foreground color for a label shown in the CALL STACK view when the debugger breaks on an exception.',
);
export const debugViewExceptionLabelBackground = registerColor(
  'debugView.exceptionLabelBackground',
  { dark: '#6C2022', light: '#A31515', hc: '#6C2022' },
  'Background color for a label shown in the CALL STACK view when the debugger breaks on an exception.',
);
export const debugViewStateLabelForeground = registerColor(
  'debugView.stateLabelForeground',
  { dark: foreground, light: foreground, hc: foreground },
  "Foreground color for a label in the CALL STACK view showing the current session's or thread's state.",
);
export const debugViewStateLabelBackground = registerColor(
  'debugView.stateLabelBackground',
  { dark: '#88888844', light: '#88888844', hc: '#88888844' },
  "Background color for a label in the CALL STACK view showing the current session's or thread's state.",
);
export const debugViewValueChangedHighlight = registerColor(
  'debugView.valueChangedHighlight',
  { dark: '#569CD6', light: '#569CD6', hc: '#569CD6' },
  'Color used to highlight value changes in the debug views (ie. in the Variables view).',
);

export const debugConsoleInfoForeground = registerColor(
  'debugConsole.infoForeground',
  { dark: editorInfoForeground, light: editorInfoForeground, hc: foreground },
  'Foreground color for info messages in debug REPL console.',
);
export const debugConsoleWarningForeground = registerColor(
  'debugConsole.warningForeground',
  { dark: editorWarningForeground, light: editorWarningForeground, hc: '#008000' },
  'Foreground color for warning messages in debug REPL console.',
);
export const debugConsoleErrorForeground = registerColor(
  'debugConsole.errorForeground',
  { dark: errorForeground, light: errorForeground, hc: errorForeground },
  'Foreground color for error messages in debug REPL console.',
);
export const debugConsoleSourceForeground = registerColor(
  'debugConsole.sourceForeground',
  { dark: foreground, light: foreground, hc: foreground },
  'Foreground color for source filenames in debug REPL console.',
);
export const debugConsoleInputIconForeground = registerColor(
  'debugConsoleInputIcon.foreground',
  { dark: foreground, light: foreground, hc: foreground },
  'Foreground color for debug console input marker icon.',
);
