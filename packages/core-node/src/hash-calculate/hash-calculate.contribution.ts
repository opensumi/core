import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { IHashCalculateService } from '@ali/ide-core-common/lib/hash-calculate/hash-calculate';
import { ServerAppContribution } from '../bootstrap';

@Domain(ServerAppContribution)
export class HashCalculateContribution implements ServerAppContribution {

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  async initialize() {
    try {
      await this.hashCalculateService.initialize();
    } catch (err) {
      throw new Error(`hashCalculateService init fail: \n ${err.message}`);
    }
  }
}
