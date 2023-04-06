module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'not-chinese-message-rule': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'not-chinese-message-rule': ({ subject }) => {
          const regex = /[\u4e00-\u9fa5]+/;
          return [!regex.test(subject), 'Please use english to rewrite your commit message'];
        },
      },
    },
  ],
};
