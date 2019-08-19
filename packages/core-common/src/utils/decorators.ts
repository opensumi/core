export function createDecorator(mapFn: (fn: Function, key: string) => Function): Function {
	return (target: any, key: string, descriptor: any) => {
		let fnKey: string | null = null;
		let fn: Function | null = null;

		if (typeof descriptor.value === 'function') {
			fnKey = 'value';
			fn = descriptor.value;
		} else if (typeof descriptor.get === 'function') {
			fnKey = 'get';
			fn = descriptor.get;
		}

		if (!fn) {
			throw new Error('not supported');
		}

		descriptor[fnKey!] = mapFn(fn, key);
	};
}

export interface IDebouceReducer<T> {
	(previousValue: T, ...args: any[]): T;
}

export function debounce<T>(delay: number, reducer?: IDebouceReducer<T>, initialValueProvider?: () => T): Function {
	return createDecorator((fn, key) => {
		const timerKey = `$debounce$${key}`;
		const resultKey = `$debounce$result$${key}`;

		return function (this: any, ...args: any[]) {
			if (!this[resultKey]) {
				this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
			}

			clearTimeout(this[timerKey]);

			if (reducer) {
				this[resultKey] = reducer(this[resultKey], ...args);
				args = [this[resultKey]];
			}

			this[timerKey] = setTimeout(() => {
				fn.apply(this, args);
				this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
			}, delay);
		};
	});
}
