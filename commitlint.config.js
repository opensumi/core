module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'not-chinese-message-rule': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'not-chinese-message-rule': ({ subject }) => {
          const regex = /[一-龥]+/;
          return [!regex.test(subject), 'Please use english to rewrite your commit message'];
        },
      },
    },
  ],
};
