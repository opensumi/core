import { ReporterService } from '../src/reporter';
import { REPORT_HOST } from '../src/types/reporter';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('packages/core-common/__tests__/reporter.test.ts', () => {
  let reporter;
  let reporterService;
  beforeEach(() => {
    reporter = {
      performance: jest.fn(),
      point: jest.fn(),
    };
    reporterService = new ReporterService(reporter, {
      host: REPORT_HOST.NODE,
    });
  });
  it.skip('use time func ', async () => {
    const reporterTimer = reporterService.time('test');
    // 执行耗时 3000 毫秒的方法
    await sleep(3000);
    reporterTimer.timeEnd('test', 'test');
    // name 为 test
    expect(reporter.performance.mock.calls[0][0]).toBe('test');
    // 延时不应该相差 1000 毫秒 (考虑 ci 机器性能）
    expect(reporter.performance.mock.calls[0][1].duration - 3000).toBeLessThan(1000);
  });
  it('use point func ', async () => {
    reporterService.point('active_extension', 'vscode.vim');
    expect(reporter.point.mock.calls[0][0]).toBe('active_extension');
    expect(reporter.point.mock.calls[0][1].msg).toBe('vscode.vim');
    expect(reporter.point.mock.calls[0][1].metadata.host).toBe(REPORT_HOST.NODE);
  });
  it.skip('concurrency time reporter', async () => {
    const func1 = async () => {
      await sleep(1000);
      const reporterTimer = reporterService.time('test');
      await sleep(1000);
      reporterTimer.timeEnd('test');
    };
    const func2 = async () => {
      const reporterTimer = reporterService.time('test');
      await sleep(3000);
      reporterTimer.timeEnd('test');
    };
    await Promise.all([func1(), func2()]);
    expect(reporter.performance.mock.calls[0][0]).toBe('test');
    expect(reporter.performance.mock.calls[1][0]).toBe('test');
    // 延时不应该相差 1000 毫秒（考虑 ci 机器性能）
    expect(reporter.performance.mock.calls[0][1].duration - 1000).toBeLessThan(1000);
    expect(reporter.performance.mock.calls[1][1].duration - 3000).toBeLessThan(1000);
  });
  it('extra data for time', async () => {
    const reporterTimer = reporterService.time('test');
    // 执行耗时 3000 毫秒的方法
    await sleep(3000);
    reporterTimer.timeEnd('test', {
      a: 'this is extra data',
    });
    // name 为 test
    expect(reporter.performance.mock.calls[0][0]).toBe('test');
    // 可以获取到附加的数据
    expect(reporter.performance.mock.calls[0][1].extra.a).toBe('this is extra data');
  });
  it('extra data for point', async () => {
    reporterService.point('test', 'test msg', {
      a: 'this is extra data',
    });
    // name 为 test
    expect(reporter.point.mock.calls[0][0]).toBe('test');
    // 可以获取到附加的数据
    expect(reporter.point.mock.calls[0][1].extra.a).toBe('this is extra data');
  });
});
