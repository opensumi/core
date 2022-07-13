const languages = ['en-US', 'zh-CN'];

describe('check data validity', () => {
  const i18nMap = new Map<string, Record<string, string>>();
  languages.forEach((v) => {
    const languageFile = require(`../src/common/${v}.lang.ts`);
    const languageBundle = languageFile.localizationBundle;

    i18nMap.set(v, languageBundle.contents);
  });
  let maxLengthKey = languages[0];
  let maxNumber = 0;
  for (const [key, data] of i18nMap.entries()) {
    const thisLength = Object.keys(data).length;
    if (thisLength > maxNumber) {
      maxNumber = thisLength;
      maxLengthKey = key;
    }
  }

  const target = i18nMap.get(maxLengthKey)!;
  const data = Object.keys(target);
  data.sort();

  i18nMap.delete(maxLengthKey);
  for (const [key, value] of i18nMap.entries()) {
    it(`${key} length should be equal ${maxLengthKey} ${data.length}`, () => {
      const _data = Object.keys(value);
      _data.sort();
      expect(_data).toBe(data);
    });
  }
});
