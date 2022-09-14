import { pad } from './strings';

export function toLocalString(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1, 2) +
    '-' +
    pad(date.getDate(), 2) +
    ' ' +
    pad(date.getHours(), 2) +
    ':' +
    pad(date.getMinutes(), 2) +
    ':' +
    pad(date.getSeconds(), 2)
  );
}

export function toLocalISOString(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1, 2) +
    '-' +
    pad(date.getDate(), 2) +
    'T' +
    pad(date.getHours(), 2) +
    ':' +
    pad(date.getMinutes(), 2) +
    ':' +
    pad(date.getSeconds(), 2) +
    '.' +
    (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5) +
    'Z'
  );
}
