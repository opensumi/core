import { log } from 'console';
import { readAllMainPackages } from '../pkg';

export function parseShard(shardString: string, length: number): [number, number] {
  const [_current, _total, ..._] = shardString.split('/');
  const current = parseInt(_current);
  if (current <= 0) {
    throw new Error(`Invalid shard: ${shardString}, first shard must be greater than 0`);
  }

  const total = parseInt(_total);

  const start = Math.floor(length / total) * (current - 1);
  let end = Math.floor(length / total) * current;
  if (current === total) {
    end = length;
  }
  return [start, end];
}

export function getShardPackages() {
  let pkgs = readAllMainPackages();
  pkgs.sort((a, b) => a.dirname.localeCompare(b.dirname));

  if (process.env.SHARD) {
    const [start, end] = parseShard(process.env.SHARD, pkgs.length);
    pkgs = pkgs.slice(start, end);
  }
  return pkgs;
}

export function __testShard() {
  log(parseShard('1/2', 2)); // [ 0, 1 ]
  log(parseShard('2/2', 2)); // [ 1, 2 ]
  log(parseShard('1/3', 56)); // [ 0, 18 ]
  log(parseShard('2/3', 56)); // [ 18, 36 ]
  log(parseShard('3/3', 56)); // [ 36, 56 ]
}

if (typeof require !== 'undefined' && require.main === module) {
  // 如果直接执行这个文件，则展示一下 shard 的示例
  __testShard();
}
