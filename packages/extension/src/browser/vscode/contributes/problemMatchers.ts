import { Injectable, Autowired } from '@opensumi/di';
import {
  ProblemMatcherContribution,
  IProblemMatcherRegistry,
  IJSONSchema,
  localize,
  deepClone,
} from '@opensumi/ide-core-common';

import { VSCodeContributePoint } from '../../../common';

import { Contributes } from './common';
import { PatternSchemas } from './problemPatterns';

export type ProblemMatchersContributions = Array<ProblemMatcherContribution>;

export namespace Schemas {
  export const WatchingPattern: IJSONSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      regexp: {
        type: 'string',
        description: localize(
          'WatchingPatternSchema.regexp',
          'The regular expression to detect the begin or end of a background task.',
        ),
      },
      file: {
        type: 'integer',
        description: localize('WatchingPatternSchema.file', 'The match group index of the filename. Can be omitted.'),
      },
    },
  };

  export const PatternType: IJSONSchema = {
    anyOf: [
      {
        type: 'string',
        description: localize('PatternTypeSchema.name', 'The name of a contributed or predefined pattern'),
      },
      PatternSchemas.ProblemPattern,
      PatternSchemas.MultiLineProblemPattern,
    ],
    description: localize(
      'PatternTypeSchema.description',
      'A problem pattern or the name of a contributed or predefined problem pattern. Can be omitted if base is specified.',
    ),
  };

  export const ProblemMatcher: IJSONSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      base: {
        type: 'string',
        description: localize('ProblemMatcherSchema.base', 'The name of a base problem matcher to use.'),
      },
      owner: {
        type: 'string',
        description: localize(
          'ProblemMatcherSchema.owner',
          "The owner of the problem inside Code. Can be omitted if base is specified. Defaults to 'external' if omitted and base is not specified.",
        ),
      },
      source: {
        type: 'string',
        description: localize(
          'ProblemMatcherSchema.source',
          "A human-readable string describing the source of this diagnostic, e.g. 'typescript' or 'super lint'.",
        ),
      },
      severity: {
        type: 'string',
        enum: ['error', 'warning', 'info'],
        description: localize(
          'ProblemMatcherSchema.severity',
          "The default severity for captures problems. Is used if the pattern doesn't define a match group for severity.",
        ),
      },
      applyTo: {
        type: 'string',
        enum: ['allDocuments', 'openDocuments', 'closedDocuments'],
        description: localize(
          'ProblemMatcherSchema.applyTo',
          'Controls if a problem reported on a text document is applied only to open, closed or all documents.',
        ),
      },
      pattern: PatternType,
      fileLocation: {
        oneOf: [
          {
            type: 'string',
            enum: ['absolute', 'relative', 'autoDetect'],
          },
          {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        ],
        description: localize(
          'ProblemMatcherSchema.fileLocation',
          'Defines how file names reported in a problem pattern should be interpreted.',
        ),
      },
      background: {
        type: 'object',
        additionalProperties: false,
        description: localize(
          'ProblemMatcherSchema.background',
          'Patterns to track the begin and end of a matcher active on a background task.',
        ),
        properties: {
          activeOnStart: {
            type: 'boolean',
            description: localize(
              'ProblemMatcherSchema.background.activeOnStart',
              'If set to true the background monitor is in active mode when the task starts. This is equals of issuing a line that matches the beginsPattern',
            ),
          },
          beginsPattern: {
            oneOf: [
              {
                type: 'string',
              },
              Schemas.WatchingPattern,
            ],
            description: localize(
              'ProblemMatcherSchema.background.beginsPattern',
              'If matched in the output the start of a background task is signaled.',
            ),
          },
          endsPattern: {
            oneOf: [
              {
                type: 'string',
              },
              Schemas.WatchingPattern,
            ],
            description: localize(
              'ProblemMatcherSchema.background.endsPattern',
              'If matched in the output the end of a background task is signaled.',
            ),
          },
        },
      },
      watching: {
        type: 'object',
        additionalProperties: false,
        deprecationMessage: localize(
          'ProblemMatcherSchema.watching.deprecated',
          'The watching property is deprecated. Use background instead.',
        ),
        description: localize(
          'ProblemMatcherSchema.watching',
          'Patterns to track the begin and end of a watching matcher.',
        ),
        properties: {
          activeOnStart: {
            type: 'boolean',
            description: localize(
              'ProblemMatcherSchema.watching.activeOnStart',
              'If set to true the watcher is in active mode when the task starts. This is equals of issuing a line that matches the beginPattern',
            ),
          },
          beginsPattern: {
            oneOf: [
              {
                type: 'string',
              },
              Schemas.WatchingPattern,
            ],
            description: localize(
              'ProblemMatcherSchema.watching.beginsPattern',
              'If matched in the output the start of a watching task is signaled.',
            ),
          },
          endsPattern: {
            oneOf: [
              {
                type: 'string',
              },
              Schemas.WatchingPattern,
            ],
            description: localize(
              'ProblemMatcherSchema.watching.endsPattern',
              'If matched in the output the end of a watching task is signaled.',
            ),
          },
        },
      },
    },
  };

  export const LegacyProblemMatcher: IJSONSchema = deepClone(ProblemMatcher);
  LegacyProblemMatcher.properties = deepClone(LegacyProblemMatcher.properties) || {};
  LegacyProblemMatcher.properties['watchedTaskBeginsRegExp'] = {
    type: 'string',
    deprecationMessage: localize(
      'LegacyProblemMatcherSchema.watchedBegin.deprecated',
      'This property is deprecated. Use the watching property instead.',
    ),
    description: localize(
      'LegacyProblemMatcherSchema.watchedBegin',
      'A regular expression signaling that a watched tasks begins executing triggered through file watching.',
    ),
  };
  LegacyProblemMatcher.properties['watchedTaskEndsRegExp'] = {
    type: 'string',
    deprecationMessage: localize(
      'LegacyProblemMatcherSchema.watchedEnd.deprecated',
      'This property is deprecated. Use the watching property instead.',
    ),
    description: localize(
      'LegacyProblemMatcherSchema.watchedEnd',
      'A regular expression signaling that a watched tasks ends executing.',
    ),
  };

  export const NamedProblemMatcher: IJSONSchema = deepClone(ProblemMatcher);
  NamedProblemMatcher.properties = deepClone(NamedProblemMatcher.properties) || {};
  NamedProblemMatcher.properties.name = {
    type: 'string',
    description: localize('NamedProblemMatcherSchema.name', 'The name of the problem matcher used to refer to it.'),
  };
  NamedProblemMatcher.properties.label = {
    type: 'string',
    description: localize('NamedProblemMatcherSchema.label', 'A human readable label of the problem matcher.'),
  };
}

export const problemMatchersSchema = {
  description: localize('ProblemMatcherExtPoint', 'Contributes problem matchers'),
  type: 'array',
  items: Schemas.NamedProblemMatcher,
};

@Injectable()
@Contributes('problemMatchers')
export class ProblemMatchersContributionPoint extends VSCodeContributePoint<ProblemMatchersContributions> {
  @Autowired(IProblemMatcherRegistry)
  problemMatcher: IProblemMatcherRegistry;

  contribute() {
    for (const matcher of this.json) {
      this.addDispose(this.problemMatcher.register(matcher));
    }
  }
}
