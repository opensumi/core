import { Injectable, Autowired } from '@opensumi/di';
import {
  IProblemPatternRegistry,
  ProblemPatternContribution,
  IJSONSchema,
  deepClone,
  localize,
} from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

export namespace PatternSchemas {
  export const ProblemPattern: IJSONSchema = {
    default: {
      regexp: '^([^\\\\s].*)\\\\((\\\\d+,\\\\d+)\\\\):\\\\s*(.*)$',
      file: 1,
      location: 2,
      message: 3,
    },
    type: 'object',
    additionalProperties: false,
    properties: {
      regexp: {
        type: 'string',
        description: localize(
          'ProblemPatternSchema.regexp',
          'The regular expression to find an error, warning or info in the output.',
        ),
      },
      kind: {
        type: 'string',
        description: localize(
          'ProblemPatternSchema.kind',
          'whether the pattern matches a location (file and line) or only a file.',
        ),
      },
      file: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.file',
          'The match group index of the filename. If omitted 1 is used.',
        ),
      },
      location: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.location',
          "The match group index of the problem's location. Valid location patterns are: (line), (line,column) and (startLine,startColumn,endLine,endColumn). If omitted (line,column) is assumed.",
        ),
      },
      line: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.line',
          "The match group index of the problem's line. Defaults to 2",
        ),
      },
      column: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.column',
          "The match group index of the problem's line character. Defaults to 3",
        ),
      },
      endLine: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.endLine',
          "The match group index of the problem's end line. Defaults to undefined",
        ),
      },
      endColumn: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.endColumn',
          "The match group index of the problem's end line character. Defaults to undefined",
        ),
      },
      severity: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.severity',
          "The match group index of the problem's severity. Defaults to undefined",
        ),
      },
      code: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.code',
          "The match group index of the problem's code. Defaults to undefined",
        ),
      },
      message: {
        type: 'integer',
        description: localize(
          'ProblemPatternSchema.message',
          'The match group index of the message. If omitted it defaults to 4 if location is specified. Otherwise it defaults to 5.',
        ),
      },
      loop: {
        type: 'boolean',
        description: localize(
          'ProblemPatternSchema.loop',
          'In a multi line matcher loop indicated whether this pattern is executed in a loop as long as it matches. Can only specified on a last pattern in a multi line pattern.',
        ),
      },
    },
  };

  export const NamedProblemPattern: IJSONSchema = deepClone(ProblemPattern);
  NamedProblemPattern.properties = deepClone(NamedProblemPattern.properties) || {};
  NamedProblemPattern!.properties['name'] = {
    type: 'string',
    description: localize('NamedProblemPatternSchema.name', 'The name of the problem pattern.'),
  };

  export const MultiLineProblemPattern: IJSONSchema = {
    type: 'array',
    items: ProblemPattern,
  };

  export const NamedMultiLineProblemPattern: IJSONSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description: localize(
          'NamedMultiLineProblemPatternSchema.name',
          'The name of the problem multi line problem pattern.',
        ),
      },
      patterns: {
        type: 'array',
        description: localize('NamedMultiLineProblemPatternSchema.patterns', 'The actual patterns.'),
        items: ProblemPattern,
      },
    },
  };
}

export const problemPatternsSchema = {
  description: localize('ProblemPatternExtPoint', 'Contributes problem patterns'),
  type: 'array',
  items: {
    anyOf: [PatternSchemas.NamedProblemPattern, PatternSchemas.NamedMultiLineProblemPattern],
  },
};

export type ProblemPatterns = Array<ProblemPatternContribution>;

@Injectable()
@Contributes('problemPatterns')
export class ProblemPatternsContributionPoint extends VSCodeContributePoint<ProblemPatterns> {
  @Autowired(IProblemPatternRegistry)
  problemPattern: IProblemPatternRegistry;

  contribute() {
    for (const pattern of this.json) {
      this.addDispose(this.problemPattern.register(pattern));
    }
  }
}
