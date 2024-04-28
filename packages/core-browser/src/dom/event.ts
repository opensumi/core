interface EventShape {
  preventDefault(): void;
  stopPropagation(): void;
}

export function withPrevented<T extends EventShape>(action?: (e: T) => void): (e: T) => void {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (action) {
      action(e);
    }
  };
}
