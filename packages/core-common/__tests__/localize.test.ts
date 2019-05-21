import { registerLocalizationBundle, localize } from "../src/localize";

describe('localize test', () => {

  it('localize with registration works', () => {

    registerLocalizationBundle({
      locale: 'zh-CN',
      messages: {
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


})