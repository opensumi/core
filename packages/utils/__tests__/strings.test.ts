import { template } from '../src/strings';

describe('strings utils', () => {
  describe('template', () => {
    it('can process base template', () => {
      const result = template(
        '${result}${separator}',
        {
          result: '233',
        },
        {
          separator: ' - ',
        },
      );
      expect(result).toBe('233');
    });
    it('can process a more complicated template case', () => {
      const result = template(
        '${${{result}$$$${separator}',
        {
          '{result': '233',
        },
        {
          separator: ' - ',
        },
      );
      expect(result).toEqual('${233$$$');
    });
    it('can reduce separator', () => {
      const result = template(
        '${separator}hahaha${separator}${result}${separator}${hello}${separator}${123}${separator}${separator}',
        {
          result: '233',
        },
        {
          separator: ' - ',
        },
      );
      expect(result).toEqual('hahaha - 233');
    });
  });
});
