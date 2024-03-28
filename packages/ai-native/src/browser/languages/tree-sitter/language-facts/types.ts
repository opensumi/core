import invert from 'lodash/invert';

const map = {
  typescript: 'typescript',
  typescriptreact: 'tsx',
  javascript: 'javascript',
  javascriptreact: 'jsx',
  rust: 'rust',
  python: 'python',
  java: 'java',
  go: 'go',
} as const;

type ValueOf<T> = T[keyof T];

export type SupportedLanguages = keyof typeof map;
export type SupportedTreeSitterLanguages = ValueOf<typeof map>;

export const parserNameMap: Record<SupportedLanguages, SupportedTreeSitterLanguages> = map;

export const parserIdentifierMap = invert(parserNameMap) as Record<SupportedTreeSitterLanguages, SupportedLanguages>;
