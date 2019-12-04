import { REPORT_HOST } from '../src/types/reporter';
import { ReporterService } from '../src/reporter';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('packages/core-common/__tests__/reporter.test.ts', () => {
  let reporter, reporterService;
  beforeEach(() => {
    reporter = {
      performance: jest.fn(),
      point: jest.fn(),
    };
    reporterService = new ReporterService(reporter, {
      host: REPORT_HOST.NODE,
    });
  });
  it('use time func ', async () => {
    reporterService.time('test');
    // 执行耗时 3000 毫秒的方法
    await sleep(3000);
    reporterService.timeEnd('test', 'test');
    // name 为 test
    expect(reporter.performance.mock.calls[0][0]).toBe('test');
    // 延时不应该相差 100 毫秒
    expect(reporter.performance.mock.calls[0][1].time - 3000).toBeLessThan(100);
  });
  it('use point func ', async () => {
    reporterService.point('active_extension', 'vscode.vim');
    expect(reporter.point.mock.calls[0][0]).toBe('active_extension');
    expect(reporter.point.mock.calls[0][1].msg).toBe('vscode.vim');
    expect(reporter.point.mock.calls[0][1].metadata.host).toBe(REPORT_HOST.NODE);
  });
});
