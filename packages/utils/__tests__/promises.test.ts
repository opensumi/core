import { sleep } from '../src/async';
import { PromiseTasks } from '../src/promises';

describe('promises', () => {
  describe('PromiseTasks', () => {
    it('any should work', async () => {
      const tasks = new PromiseTasks<string>();

      tasks.add(async () => {
        await sleep(100);
        return 'a';
      });
      tasks.add(async () => {
        await sleep(150);
        return 'b';
      });
      tasks.add(async () => {
        throw new Error('ignore');
      });
      tasks.add(async () => {
        await sleep(50);
        throw new Error('ignore');
      });

      const result = await tasks.any();

      expect(result).toBe('a');
    });
    it("should return undefined when all of the input's promises reject", async () => {
      const tasks = new PromiseTasks<string>();

      tasks.add(async () => {
        throw new Error('ignore');
      });
      tasks.add(async () => {
        throw new Error('ignore');
      });

      const result = await tasks.any();

      expect(result).toBeUndefined();
    });
  });
});
