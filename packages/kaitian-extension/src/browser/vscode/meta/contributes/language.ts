// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { LanguagesContribution } from '@ali/ide-monaco';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';

export type LanguagesSchema = Array<LanguagesContribution>;

@Injectable()
@Contributes('languages')
export class LanguagesContributionPoint extends VSCodeContributePoint<LanguagesSchema> {
  @Autowired()
  textMateService: TextmateService;

  contribute() {
    for (const language of this.json) {
      this.textMateService.registerLanguage(language, this.extension.path);
    }
  }
}
