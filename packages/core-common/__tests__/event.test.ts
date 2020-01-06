import { Emitter } from "../src/event";

describe('event listener test suite', () => {


  it('event emitter fire and await should work', async (done) =>{

    const emitter = new Emitter();

    const successListener = (args1) => {
      return args1 + 1;
    }

    const errorListener = (args1) => {
      throw new Error('test Error');
    }

    const timeoutListener = async () => {
      return new Promise(resolve => {});
    }

    emitter.event(successListener);
    emitter.event(errorListener);
    emitter.event(timeoutListener);

    const res = await emitter.fireAndAwait(1, 100);

    expect(res[0].err).toBeUndefined();
    expect(res[0].result).toBe(2);

    expect(res[1].err).toBeDefined();
    expect(res[1].err?.message).toBe('test Error');
    expect(res[1].result).toBeUndefined();

    expect(res[2].err).toBeDefined();
    expect(res[2].err?.message).toBe('timeout');
    expect(res[2].result).toBeUndefined();
 
    done();
  });

});