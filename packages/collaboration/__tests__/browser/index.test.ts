import { CollaborationModule } from '../../src/browser';
import { CollaborationContribution } from '../../src/browser/collaboration.contribution';

describe('contribution', () => {
  it('Correctly create module', () => {
    const module = new CollaborationModule();
    expect(module.providers).toEqual([CollaborationContribution]);
  });
});
