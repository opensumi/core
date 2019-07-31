import { registerLocalizationBundle, localize } from "../src/localize";

describe('localize test', () => {

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

})