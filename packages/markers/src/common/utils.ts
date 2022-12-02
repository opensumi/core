export function getMarkerCodeValue(
  code:
    | string
    | {
        value: string;
        target: any;
      },
): string {
  return typeof code === 'object' ? code.value : code;
}
