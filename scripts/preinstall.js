let err = false;

if (!/yarn$|yarn[\w-.]*\.c?js$|yarnpkg$/.test(process.env['npm_execpath'])) {
  console.error('\033[1;31mPlease use yarn to install dependencies.\033[0;0m');
  err = true;
}

if (err) {
  console.error('');
  process.exit(1);
}
