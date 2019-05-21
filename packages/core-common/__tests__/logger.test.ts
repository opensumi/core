import { getLogger } from "../src/logger";

describe('logger test', () => {

  it('use console defaultly', () => {

    expect(getLogger()).toEqual(console);
    getLogger().log('log1', 'log2', 'log3');
    getLogger().error('error1', 'error2', 'error3');
    getLogger().warn('warn1', 'warn2', 'warn3');
    getLogger().debug('debug1', 'debug2', 'debug3');

  })
  

})