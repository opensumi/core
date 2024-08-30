const { ESLintUtils } = require('@typescript-eslint/utils');

const { replaceImportDefault } = require('../../ast-grep/replace-import-default');

const pkgName = 'classnames';
const expectLocalName = 'cls';

const rule = ESLintUtils.RuleCreator.withoutDocs({
  defaultOptions: [{}],
  meta: {
    type: 'suggestion',
    docs: {
      description: `Enforce a consistent import name for the "${pkgName}" library`,
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      unexpectedImportName: `Expected "${pkgName}" to be imported as "${expectLocalName}".`,
    },
    fixable: 'code',
    schema: [], // No options
  },
  create: (context) => ({
    ImportDeclaration(node) {
      const { source, specifiers } = node;
      if (source.value === pkgName) {
        specifiers.forEach((specifier) => {
          if (specifier.type === 'ImportDefaultSpecifier' && specifier.local.name !== expectLocalName) {
            // 报告问题并提供修复方案
            context.report({
              node: specifier.local,
              messageId: 'unexpectedImportName',
              fix: (fixer) => {
                const sourceCode = context.getSourceCode();
                const source = sourceCode.text;
                const result = replaceImportDefault(source, pkgName, expectLocalName);

                return fixer.replaceTextRange(sourceCode.ast.range, result);
              },
            });
          }
        });
      }
    },
  }),
});

module.exports = rule;
