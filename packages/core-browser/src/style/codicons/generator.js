const fs = require('fs');
const path = require('path');
const pkg = require.resolve('@vscode/codicons/package.json');
const cssFile = path.join(pkg, '../dist/codicon.css');
const cssContent = fs.readFileSync(cssFile, 'utf8');
const nameIt = cssContent.matchAll(/\.codicon-(?<name>[\w-]+)+:before\s*{.+}/g);
const formattedName = JSON.stringify([...nameIt].map((item) => item.groups.name))
  .replace(/"/g, "'")
  .replace(/,/g, '$& ');
// eslint-disable-next-line no-console
console.log(formattedName);
const curFile = path.join(__dirname, 'README.md');
let curFileContent = fs.readFileSync(curFile, 'utf8');
curFileContent = curFileContent.replace(/(<codicon>)([\s\S]+)(<\/codicon>)/, `$1\n${formattedName}\n$3`);
fs.writeFileSync(path.join(__dirname, 'README.md'), curFileContent);
