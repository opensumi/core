import { registerLocalizationBundle, localize, setLanguageId, replaceLocalizePlaceholder, replaceNlsField, getLanguageId } from "../src/localize";

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

  it('ensure getLanguageId work', () => {
    const lang = getLanguageId();
    expect(lang).toEqual('zh-CN');
    setLanguageId("LaNg nOt exsts");
    const lang2 = getLanguageId();
    expect(lang2).toEqual('LaNg nOt exsts');
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
    // 测试替换字符串中的所有占位符

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        "someMessage1": '消息1',
        "someMessage2": '消息2',
      }
    })

    expect(replaceLocalizePlaceholder('%someMessage1% %someMessage2%')).toEqual('消息1 消息2');
    expect(replaceLocalizePlaceholder('%someMessage1% %NotExists%')).toEqual('消息1 %NotExists%');
    expect(replaceLocalizePlaceholder('111%NotExists%')).toEqual("111%NotExists%");
  })

  it('test replaceNlsField', () => {
    // 测试是否只会替换 placeholder，即只替换形如 %someMessage% 的字符串

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        "someMessage": '一段消息',
      }
    })

    expect(replaceNlsField('someMessage')).toEqual('someMessage');
    expect(replaceNlsField('%someMessage%')).toEqual('一段消息');
    expect(replaceNlsField('%NotExists%')).toEqual('');
    expect(replaceNlsField('%NotExists%', 'host','fallback')).toEqual('fallback');
  })

  it('should ignore languageId case', () => {
    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        "someMessage1": '消息1',
      }
    })
    registerLocalizationBundle({
      languageId: 'ZH-CN',
      languageName: '中文',
      localizedLanguageName: '中文',
      contents: {
        "someMessage2": '消息2',
      }
    })
    expect(replaceLocalizePlaceholder('%someMessage1% %someMessage2%')).toEqual('消息1 消息2');
  })
})
