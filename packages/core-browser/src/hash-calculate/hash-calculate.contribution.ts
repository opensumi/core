import { Autowired } from '@ide-framework/common-di';
import { Domain } from '@ide-framework/ide-core-common/lib/di-helper';
import { IHashCalculateService } from '@ide-framework/ide-core-common/lib/hash-calculate/hash-calculate';

import { ClientAppContribution } from '../common/common.define';

@Domain(ClientAppContribution)
export class HashCalculateContribution implements ClientAppContribution {

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  async onStart() {
    try {
      await this.hashCalculateService.initialize();
    } catch (err) {
      throw new Error(`hashCalculateService init fail: \n ${err.message}`);
    }
  }

}
