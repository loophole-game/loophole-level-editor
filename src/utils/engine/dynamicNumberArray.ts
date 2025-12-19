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
        if (this.#pointer >= this.#buffer.length) {
            const newBuffer = new this.#ctor(this.#buffer.length * 2);
            newBuffer.set(this.#buffer);
            this.#buffer = newBuffer;
        }

        this.#buffer[this.#pointer++] = value;
    }

    pop(count = 1) {
        this.#pointer = Math.max(0, this.#pointer - count);
    }

    clear() {
        this.#pointer = 0;
    }
}
