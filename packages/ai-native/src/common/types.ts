export enum NearestCodeBlockType {
  Block = 'block',
  Line = 'line',
}

export interface INearestCodeBlock {
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
  codeBlock: string;
  offset: number;
  type?: NearestCodeBlockType;
}
