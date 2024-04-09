const { ESLintUtils } = require('@typescript-eslint/utils');

const rule = ESLintUtils.RuleCreator.withoutDocs({
  defaultOptions: [{}],
  meta: {
    type: 'suggestion',
    docs: {
      description: `EventEmitter should be disposed when the component is destroyed.`,
      category: 'Best Practices',
    },
    messages: {
      shouldDisposeEmitter: `\`new Emitter()\` might need to be disposed. Consider using \`this.registerDispose()\` or \`this._disposables.add()\` to dispose it when the component is destroyed.`,
      surroundWithRegisterDispose: `Surround with this.registerDispose()`,
      surroundWithDisposablesAdd: `Surround with this._disposables.add()`,
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [], // No options
  },
  create: (context) => {
    return {
      NewExpression(node) {
        if (node.callee.name === 'Emitter') {
          const parent = node.parent;
          if (!parent) {
            return;
          }
          // 不是赋值操作
          if (parent.type !== 'PropertyDefinition') {
            return;
          }

          context.report({
            node,
            messageId: 'shouldDisposeEmitter',
            suggest: [
              {
                messageId: 'surroundWithRegisterDispose',
                fix: (fixer) => {
                  return [fixer.insertTextBefore(node, 'this.registerDispose('), fixer.insertTextAfter(node, ')')];
                },
              },
              {
                messageId: 'surroundWithDisposablesAdd',
                fix: (fixer) => {
                  return [fixer.insertTextBefore(node, 'this._disposables.add('), fixer.insertTextAfter(node, ')')];
                },
              },
            ],
          });
        }
      },
    };
  },
});

module.exports = rule;
