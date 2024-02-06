const { tsx } = require('@ast-grep/napi');
const MagicString = require('magic-string').default;

/**
 * Replace the local variable name of the import statement
 */
const replaceImportDefault = (source, pkgName, expectLocalName) => {
  const magic = new MagicString(source);

  const ast = tsx.parse(source); // 1. parse the source
  const root = ast.root(); // 2. get the root
  const node = root.find({
    rule: {
      pattern: `import $LOCAL from '${pkgName}';`,
    },
  });

  // 3. find the node
  const localNode = node.getMatch('LOCAL');
  const localNodeText = localNode.text();

  const range = localNode.range();
  magic.overwrite(range.start.index, range.end.index, expectLocalName);

  const matches = root.findAll({
    rule: {
      kind: 'call_expression',
      pattern: `${localNodeText}($$$)`,
    },
  });

  matches.forEach((v) => {
    // must be identifier
    const dd = v.child(0);
    if (dd.kind() !== 'identifier') {
      console.error(`cannot find ${pkgName} call expression`);
      return;
    }

    const ddRange = dd.range();
    magic.overwrite(ddRange.start.index, ddRange.end.index, expectLocalName);
  });

  const result = magic.toString();
  return result;
};

exports.replaceImportDefault = replaceImportDefault;
