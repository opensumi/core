let err = false;

if (parseInt(process.versions.node.split('.')[0], 10) < 18) {
  console.error('\x1b[1;31mPlease use Node.js >= 18.\x1b[0;0m');
  err = true;
}

if (!/yarn$|yarn[\w-.]*\.c?js$|yarnpkg$/.test(process.env['npm_execpath'])) {
  console.error('\x1b[1;31mPlease use yarn to install dependencies.\x1b[0;0m');
  err = true;
}

if (err) {
  console.error('');
  process.exit(1);
}
