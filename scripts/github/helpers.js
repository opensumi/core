const createVersionText = (type = 'Pre-Release', version, context) => {
  return (
    `<!-- versionInfo: ${type} | ${version} -->\n` +
    `🎉 ${type} version ` +
    version +
    ' publish successful! You can install prerelease version via `npm install package@' +
    version +
    ' `' +
    ' [@' +
    context.payload.comment.user.login +
    ']' +
    '(https://github.com/' +
    context.payload.comment.user.login +
    ')\n\n' +
    '```\n' +
    version +
    '\n' +
    '```\n'
  );
};

module.exports = {
  createVersionText,
};
