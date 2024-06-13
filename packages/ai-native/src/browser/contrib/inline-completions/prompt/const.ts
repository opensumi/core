export const LANGUAGE_COMMENT_MARKERS: {
  [key: string]: {
    start: string;
    end: string;
  };
} = {
  abap: {
    start: '"',
    end: '',
  },
  bat: {
    start: 'REM',
    end: '',
  },
  bibtex: {
    start: '%',
    end: '',
  },
  blade: {
    start: '#',
    end: '',
  },
  c: {
    start: '//',
    end: '',
  },
  clojure: {
    start: ';',
    end: '',
  },
  coffeescript: {
    start: '//',
    end: '',
  },
  cpp: {
    start: '//',
    end: '',
  },
  csharp: {
    start: '//',
    end: '',
  },
  css: {
    start: '/*',
    end: '*/',
  },
  dart: {
    start: '//',
    end: '',
  },
  dockerfile: {
    start: '#',
    end: '',
  },
  elixir: {
    start: '#',
    end: '',
  },
  erb: {
    start: '<%#',
    end: '%>',
  },
  erlang: {
    start: '%',
    end: '',
  },
  fsharp: {
    start: '//',
    end: '',
  },
  go: {
    start: '//',
    end: '',
  },
  groovy: {
    start: '//',
    end: '',
  },
  haml: {
    start: '-#',
    end: '',
  },
  handlebars: {
    start: '{{!',
    end: '}}',
  },
  haskell: {
    start: '--',
    end: '',
  },
  html: {
    start: '\x3c!--',
    end: '--\x3e',
  },
  ini: {
    start: ';',
    end: '',
  },
  java: {
    start: '//',
    end: '',
  },
  javascript: {
    start: '//',
    end: '',
  },
  javascriptreact: {
    start: '//',
    end: '',
  },
  jsonc: {
    start: '//',
    end: '',
  },
  jsx: {
    start: '//',
    end: '',
  },
  julia: {
    start: '#',
    end: '',
  },
  kotlin: {
    start: '//',
    end: '',
  },
  latex: {
    start: '%',
    end: '',
  },
  less: {
    start: '//',
    end: '',
  },
  lua: {
    start: '--',
    end: '',
  },
  makefile: {
    start: '#',
    end: '',
  },
  markdown: {
    start: '[]: #',
    end: '',
  },
  'objective-c': {
    start: '//',
    end: '',
  },
  'objective-cpp': {
    start: '//',
    end: '',
  },
  perl: {
    start: '#',
    end: '',
  },
  php: {
    start: '//',
    end: '',
  },
  powershell: {
    start: '#',
    end: '',
  },
  pug: {
    start: '//',
    end: '',
  },
  python: {
    start: '#',
    end: '',
  },
  ql: {
    start: '//',
    end: '',
  },
  r: {
    start: '#',
    end: '',
  },
  razor: {
    start: '\x3c!--',
    end: '--\x3e',
  },
  ruby: {
    start: '#',
    end: '',
  },
  rust: {
    start: '//',
    end: '',
  },
  sass: {
    start: '//',
    end: '',
  },
  scala: {
    start: '//',
    end: '',
  },
  scss: {
    start: '//',
    end: '',
  },
  shellscript: {
    start: '#',
    end: '',
  },
  slim: {
    start: '/',
    end: '',
  },
  solidity: {
    start: '//',
    end: '',
  },
  sql: {
    start: '--',
    end: '',
  },
  stylus: {
    start: '//',
    end: '',
  },
  svelte: {
    start: '\x3c!--',
    end: '--\x3e',
  },
  swift: {
    start: '//',
    end: '',
  },
  terraform: {
    start: '#',
    end: '',
  },
  tex: {
    start: '%',
    end: '',
  },
  typescript: {
    start: '//',
    end: '',
  },
  typescriptreact: {
    start: '//',
    end: '',
  },
  vb: {
    start: "'",
    end: '',
  },
  verilog: {
    start: '//',
    end: '',
  },
  'vue-html': {
    start: '\x3c!--',
    end: '--\x3e',
  },
  vue: {
    start: '//',
    end: '',
  },
  xml: {
    start: '\x3c!--',
    end: '--\x3e',
  },
  xsl: {
    start: '\x3c!--',
    end: '--\x3e',
  },
  yaml: {
    start: '#',
    end: '',
  },
  diff: {
    start: '#',
    end: '',
  },
};

export const EXCLUDED_NEIGHBORS = ['node_modules', 'dist', 'site-packages'];
export const MAX_NEIGHBOR_AGGREGATE_LENGTH = 2e5;
