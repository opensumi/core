import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { DocumentMapping } from '../model/document-mapping';
import { LineRange } from '../model/line-range';
import { LineRangeMapping } from '../model/line-range-mapping';
import { EDiffRangeTurn } from '../types';

@Injectable()
export class MappingManagerService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public documentMappingTurnLeft: DocumentMapping;
  public documentMappingTurnRight: DocumentMapping;

  constructor() {
    super();

    this.documentMappingTurnLeft = this.injector.get(DocumentMapping, [EDiffRangeTurn.ORIGIN]);
    this.documentMappingTurnRight = this.injector.get(DocumentMapping, [EDiffRangeTurn.MODIFIED]);
  }

  private markCompleteFactory(turn: EDiffRangeTurn): (range: LineRange, isIgnore: boolean) => void {
    const [mapping, sameMapping] =
      turn === EDiffRangeTurn.ORIGIN
        ? [this.documentMappingTurnLeft, this.documentMappingTurnRight]
        : [this.documentMappingTurnRight, this.documentMappingTurnLeft];

    return (range: LineRange, isIgnore: boolean) => {
      const doMark = () => {
        mapping.computeRangeMap.delete(range.id);
        mapping.adjacentComputeRangeMap.delete(range.id);
      };

      if (isIgnore) {
        doMark();
      } else {
        const sameRange = mapping.adjacentComputeRangeMap.get(range.id);
        if (!sameRange) {
          return;
        }

        const marginLength = range.calcMargin(sameRange);

        mapping.deltaAdjacentQueue(range, marginLength);
        doMark();

        const findNextRange = sameMapping.huntForNextSameRange(sameRange);
        const reverseRange = findNextRange && sameMapping.reverse(findNextRange);
        if (reverseRange) {
          sameMapping.deltaAdjacentQueue(reverseRange, marginLength);
        }
      }
    };
  }

  public inputComputeResultRangeMappingTurnLeft(changes: LineRangeMapping[]): void {
    this.documentMappingTurnLeft.inputComputeResultRangeMapping(changes);
  }

  public inputComputeResultRangeMappingTurnRight(changes: LineRangeMapping[]): void {
    this.documentMappingTurnRight.inputComputeResultRangeMapping(changes);
  }

  public markCompleteTurnLeft(range: LineRange, isIgnore = false): void {
    this.markCompleteFactory(EDiffRangeTurn.ORIGIN)(range, isIgnore);
  }

  public markCompleteTurnRight(range: LineRange, isIgnore = false): void {
    this.markCompleteFactory(EDiffRangeTurn.MODIFIED)(range, isIgnore);
  }
}
