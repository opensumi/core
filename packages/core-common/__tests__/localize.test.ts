import { registerLocalizationBundle, localize, setLanguageId, replaceLocalizePlaceholder } from "../src/localize";

describe('localize test', () => {

  beforeEach(() => {
    setLanguageId('zh-CN')
  })

  it('localize with registration works', () => {

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        someMessage: 'Some Simple Message'
      }
    })

    const message = localize('someMessage');

    expect(message).toEqual('Some Simple Message');

  })


  it('localize without registration should use default', () => {

    const message = localize('some other Message', 'default Message');

    expect(message).toEqual('default Message');

  })

  it('multiple register should respect last one', () => {

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        someMessage: 'Some Simple Message',
        someOtherMessage: 'Some Other Message'
      }
    })

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        someMessage: 'Some Simple Message2'
      }
    })

    expect(localize('someMessage')).toEqual('Some Simple Message2');
    expect(localize('someOtherMessage')).toEqual('Some Other Message');

  })


  it('test replaceLocalizePlaceholder', () => {
    // 测试是否只会替换 placeholder，即只替换形如 %someMessage% 的字符串

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        "someMessage": '因为相信，所以看见',
      }
    })

    expect(replaceLocalizePlaceholder('someMessage')).toEqual('someMessage');
    expect(replaceLocalizePlaceholder('%someMessage%')).toEqual('因为相信，所以看见');
    expect(replaceLocalizePlaceholder('%NotExists%')).toEqual('');
    expect(replaceLocalizePlaceholder('%NotExists%', 'host','fallback')).toEqual('fallback');
  })
})
