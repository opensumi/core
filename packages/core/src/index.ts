// add another package with `yo lerna-typescript:package my-new-package` instead of `lerna create`

export function greet(name: string): string {
  return `greeter says: hello to ${name}`;
}

function Greete(t: any) {
  // tslint:disable-next-line
  console.log(555, t);
}

@Greete
export class Adder {
  add(a: number, b: number): number {
    return a + b;
  }
}
