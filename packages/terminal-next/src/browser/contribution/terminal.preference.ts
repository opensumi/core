import { PreferenceContribution } from '@opensumi/ide-core-browser';
import { Domain, PreferenceSchema } from '@opensumi/ide-core-common';
import { terminalPreferenceSchema } from '../../common/preference';

@Domain(PreferenceContribution)
export class TerminalPreferenceContribution implements PreferenceContribution {
  public schema: PreferenceSchema = terminalPreferenceSchema;
}
