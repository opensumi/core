import { fixLayout } from '../../../src/components/layout/default-layout';

describe('default layout storage', () => {
  it('should remove legacy undefined layout entries', () => {
    expect(
      fixLayout({
        undefined: {},
        view: {
          currentId: 'explorer',
          size: 310,
        },
      }),
    ).toEqual({
      view: {
        currentId: 'explorer',
        size: 310,
      },
    });
  });
});
