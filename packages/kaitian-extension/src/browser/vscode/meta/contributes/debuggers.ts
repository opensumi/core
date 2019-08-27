import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable } from '@ali/common-di';
import { IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-common';

export interface VSCodePlatformSpecificAdapterContribution {
  program?: string;
  args?: string[];
  runtime?: string;
  runtimeArgs?: string[];
}

export interface DebuggersContributionScheme extends VSCodePlatformSpecificAdapterContribution {
  type: string;
  label?: string;
  languages?: string[];
  configurationSnippets?: IJSONSchemaSnippet[];
  configurationAttributes?: {
      [request: string]: IJSONSchema,
  };
  win?: VSCodePlatformSpecificAdapterContribution;
  winx86?: VSCodePlatformSpecificAdapterContribution;
  windows?: VSCodePlatformSpecificAdapterContribution;
  osx?: VSCodePlatformSpecificAdapterContribution;
  linux?: VSCodePlatformSpecificAdapterContribution;
}

@Injectable()
@Contributes('debuggers')
export class ColorsContributionPoint extends VSCodeContributePoint<DebuggersContributionScheme[]> {
  contribute() {
  }
}
