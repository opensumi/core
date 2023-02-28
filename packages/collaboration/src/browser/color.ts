// 默认配置色
const defaultColors: [string, string][] = [
  ['#000000', '#FFB900'],
  ['#000000', '#00B294'],
  ['#000000', '#FFF100'],
  ['#000000', '#B4A0FF'],
  ['#000000', '#BAD80A'],
  ['#000000', '#FF8C00'],
  ['#FFFFFF', '#107C10'],
  ['#FFFFFF', '#B4009E'],
  ['#FFFFFF', '#E3008C'],
  ['#FFFFFF', '#5C2D91'],
];

// get color by clientID
export const getColorByClientID = (id: number): [string, string] => defaultColors[id % defaultColors.length];
