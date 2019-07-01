import { CommandsSchema, CommandsContributionPoint } from './commands';
import { Disposable, ConstructorOf, getLogger } from '@ali/ide-core-browser';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VscodeContributionPoint, CONTRIBUTE_NAME_KEY } from './common';

export interface ContributesSchema {

  commands: CommandsSchema;

}

export interface ContributionPointEntry {
  name: 'commands';
  point: ConstructorOf<VscodeContributionPoint>;
}

@Injectable({multiple: true})
export class VscodeContributesRunner extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  static ContributionPoints: ConstructorOf<VscodeContributionPoint>[] = [
    CommandsContributionPoint,
  ];

  constructor(private contributes: ContributesSchema) {
    super();
  }

  async run() {

    for (const contributionCls of VscodeContributesRunner.ContributionPoints) {
      const contributesName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, contributionCls);
      if (this.contributes[contributesName] !== undefined) {
        try {
          const contributionPoint = this.injector.get(contributionCls, [this.contributes[contributesName], this.contributes]);
          this.addDispose(contributionPoint);
          await contributionPoint.contribute();
        } catch (e) {
          getLogger().error(e);
        }
      }
    }

  }

}
