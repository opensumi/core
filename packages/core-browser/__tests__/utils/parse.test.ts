import { LabelIcon, parseLabel } from '../../src/utils/parse';

describe('it can parse', () => {
  it('can parse label with icon', () => {
    const labels = parseLabel('$(hello) world');
    expect(labels).toHaveLength(2);
    expect((labels[0] as LabelIcon).name).toEqual('hello');
  });
  it('can parse label with multiple icon', () => {
    const labels = parseLabel('$(hello) world $(qwq)');
    expect(labels).toHaveLength(3);
    expect((labels[0] as LabelIcon).name).toEqual('hello');
    expect((labels[2] as LabelIcon).name).toEqual('qwq');
  });

  it('can parse label with icon animation', () => {
    const labels = parseLabel('$(hello~spin) world $(qwq)');
    expect(labels).toHaveLength(3);
    expect((labels[0] as LabelIcon).name).toEqual('hello');
    expect((labels[0] as LabelIcon).owner).toBeUndefined();
    expect((labels[0] as LabelIcon).animation).toEqual('spin');
    expect((labels[2] as LabelIcon).name).toEqual('qwq');
    expect((labels[2] as LabelIcon).owner).toBeUndefined();
  });
  it('can parse label with icon owner', () => {
    const labels = parseLabel('$(kt/hello~spin) world $(qwq)');
    expect(labels).toHaveLength(3);
    expect((labels[0] as LabelIcon).name).toEqual('hello');
    expect((labels[0] as LabelIcon).animation).toEqual('spin');
    expect((labels[0] as LabelIcon).owner).toEqual('kt');
    expect((labels[2] as LabelIcon).name).toEqual('qwq');
    expect((labels[2] as LabelIcon).owner).toBeUndefined();
  });
});
