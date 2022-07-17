import { CollaborationServiceForClientPath, ICollaborationService } from '../../src';
import { CollaborationModule } from '../../src/browser';
import { CollaborationContribution } from '../../src/browser/collaboration.contribution';
import { CollaborationService } from '../../src/browser/collaboration.service';

describe('CollaborationModule', () => {
  it('correctly create module with providers and backServices', () => {
    const module = new CollaborationModule();
    expect(module.providers).toEqual([
      CollaborationContribution,
      {
        token: ICollaborationService,
        useClass: CollaborationService,
      },
    ]);
    expect(module.backServices).toEqual([
      {
        servicePath: CollaborationServiceForClientPath,
      },
    ]);
  });
});
