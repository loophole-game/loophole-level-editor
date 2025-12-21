type ArrayType =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;
type ArrayTypeConstructor<T extends ArrayType> = new (length: number) => T;

export class DynamicNumberArray<T extends ArrayType> {
    #buffer: T;
    #pointer: number = 0;
    #ctor: ArrayTypeConstructor<T>;

    constructor(ctor: new (length: number) => T, length: number) {
        this.#ctor = ctor;
        this.#buffer = new ctor(length);
        this.#pointer = 0;
    }

    get length(): number {
        return this.#pointer;
    }

    get buffer(): T {
        return this.#buffer;
    }

    push(value: number) {
        if (this.#pointer + 1 > this.#buffer.length) {
            const newBuffer = new this.#ctor(Math.max(this.#pointer + 1, this.#buffer.length * 2));
            newBuffer.set(this.#buffer);
            this.#buffer = newBuffer;
        }

        this.#buffer[this.#pointer++] = value;
    }

    pushMultiple(
        v1: number,
        v2?: number,
        v3?: number,
        v4?: number,
        v5?: number,
        v6?: number,
        v7?: number,
        v8?: number,
        v9?: number,
    ) {
        const count = arguments.length;
        if (this.#pointer + count > this.#buffer.length) {
            const newBuffer = new this.#ctor(
                Math.max(this.#pointer + count, this.#buffer.length * 2),
            );
            newBuffer.set(this.#buffer);
            this.#buffer = newBuffer;
        }

        this.#buffer[this.#pointer++] = v1;
        if (count > 1) this.#buffer[this.#pointer++] = v2!;
        if (count > 2) this.#buffer[this.#pointer++] = v3!;
        if (count > 3) this.#buffer[this.#pointer++] = v4!;
        if (count > 4) this.#buffer[this.#pointer++] = v5!;
        if (count > 5) this.#buffer[this.#pointer++] = v6!;
        if (count > 6) this.#buffer[this.#pointer++] = v7!;
        if (count > 7) this.#buffer[this.#pointer++] = v8!;
        if (count > 8) this.#buffer[this.#pointer++] = v9!;
    }

    pop(count = 1) {
        this.#pointer = Math.max(0, this.#pointer - count);
    }

    clear() {
        this.#pointer = 0;
    }
}
