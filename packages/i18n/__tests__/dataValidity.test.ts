const languages = ['en-US', 'zh-CN'];

describe('check data validity', () => {
  it('all i18n key should valid', () => {
    const i18nMap = new Map<string, Record<string, string>>();
    languages.forEach((v) => {
      const languageFile = require(`../src/common/${v}.lang.ts`);
      const languageBundle = languageFile.localizationBundle;

      i18nMap.set(v, languageBundle.contents);
    });
    let firstKeyLength;
    const expectData = {};
    const actualData = {};
    for (const [key, data] of i18nMap.entries()) {
      const thisLength = Object.keys(data).length;
      if (!firstKeyLength) {
        firstKeyLength = thisLength;
      }
      expectData[key] = firstKeyLength;
      actualData[key] = thisLength;
    }
    expect(expectData).toBe(actualData);
  });
});
