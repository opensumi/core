// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { GrammarsContribution } from '@ali/ide-monaco';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';

export type GrammarSchema = Array<GrammarsContribution>;

@Injectable()
@Contributes('grammars')
export class GrammarsContributionPoint extends VSCodeContributePoint<GrammarSchema> {
  @Autowired()
  textMateService: TextmateService;

  contribute() {
    for (const grammar of this.json) {
      this.textMateService.registerGrammar(grammar, this.extension.path);
    }
  }
}
