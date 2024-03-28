const path = require('path');

const childProcess = require('child_process');

const pkgJson = require('../package.json');
const { mkdirSync } = require('fs-extra');

const parserPkgNamePrefix = 'tree-sitter-';
const sourceDir = path.join(__dirname, '../node_modules');
const outputDir = path.join(__dirname, '../packages/ai-native/src/common/parsers');

mkdirSync(outputDir, { recursive: true });

const parserMap = {
  typescript: ['typescript', 'tsx'],
  java: [''],
  javascript: [''],
  rust: [''],
  go: [''],
  python: [''],
};

const parsers = Object.keys(pkgJson.devDependencies).filter(
  (k) => k !== 'tree-sitter-cli' && k.startsWith(parserPkgNamePrefix),
);

for (const parser of parsers) {
  const languageName = parser.substring(parserPkgNamePrefix.length);
  const sub = parserMap[languageName];
  if (!sub) {
    console.log(`skip ${parser}`);
    continue;
  }
  for (const language of parserMap[languageName]) {
    const dir = path.join(sourceDir, `${parser}/${language}`);
    const grammerJson = path.join(dir, 'src/grammar.json');
    const grammerName = require(grammerJson).name;
    console.log(`build gramme:`, grammerName);
    const wasmName = `tree-sitter-${grammerName}.wasm`;
    // npm install -g tree-sitter-cli
    // next line cmd need tree-sitter>=0.22.2
    // const cmd = `tree-sitter build --wasm --output ${outputDir}/${wasmName} ${dir}`;

    // npm install -g tree-sitter-cli@0.20.8
    // need tree-sitter===0.20.8, because of https://github.com/tree-sitter/tree-sitter/issues/3233
    const cmd = `tree-sitter build-wasm ${dir}`;
    commandSync(cmd);
    commandSync(`mv ${wasmName} ${outputDir}/${wasmName}`);
  }
}

function commandSync(cmd) {
  console.log(`[RUN]`, cmd);
  childProcess.execSync(cmd, {
    stdio: 'inherit',
  });
}
