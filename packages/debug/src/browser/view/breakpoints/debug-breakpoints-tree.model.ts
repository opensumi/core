import { IBasicTreeData } from "@opensumi/ide-components";
import { BreakpointItem } from './debug-breakpoints.view';

export interface IBreakpointsBasicTreeData extends IBasicTreeData {

}

export class BreakpointsTreeNode implements IBreakpointsBasicTreeData {
  public label: string = '';
  public rawData: BreakpointItem

  constructor(label: string, rawData: BreakpointItem) {
    this.label = label;
    this.rawData = rawData;
  }


}
