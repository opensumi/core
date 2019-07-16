export interface ApplicationError<C extends number, D> extends Error {
    readonly code: C
    readonly data: D
    toJson(): ApplicationError.Literal<D>
}
export namespace ApplicationError {
    export interface Literal<D> {
        message: string
        data: D
        stack?: string
    }
    export interface Constructor<C extends number, D> {
        (...args: any[]): ApplicationError<C, D>;
        code: C;
        is(arg: object | undefined): arg is ApplicationError<C, D>
    }
    const codes: number[] = [];
    // 用于定义应用错误码
    export function declare<C extends number, D>(code: C, factory: (...args: any[]) => Literal<D>): Constructor<C, D> {
        if (codes.indexOf(code) !== -1) {
            throw new Error(`An application error for '${code}' code is already declared`);
        }
        const constructorOpt = Object.assign((...args: any[]) => new Impl(code, factory(...args), constructorOpt), {
            code,
            is(arg: object | undefined): arg is ApplicationError<C, D> {
                return arg instanceof Impl && arg.code === code;
            }
        });
        return constructorOpt;
    }
    export function is<C extends number, D>(arg: object | undefined): arg is ApplicationError<C, D> {
        return arg instanceof Impl;
    }
    export function fromJson<C extends number, D>(code: C, raw: Literal<D>): ApplicationError<C, D> {
        return new Impl(code, raw);
    }
    class Impl<C extends number, D> extends Error implements ApplicationError<C, D>  {
        readonly data: D;
        constructor(
            readonly code: C,
            raw: ApplicationError.Literal<D>,
            constructorOpt?: Function
        ) {
            super(raw.message);
            this.data = raw.data;
            Object.setPrototypeOf(this, Impl.prototype);
            if (raw.stack) {
                this.stack = raw.stack;
            } else if (Error.captureStackTrace && constructorOpt) {
                Error.captureStackTrace(this, constructorOpt);
            }
        }
        toJson(): ApplicationError.Literal<D> {
            const { message, data, stack } = this;
            return { message, data, stack };
        }
    }
}
