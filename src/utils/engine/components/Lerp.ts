import { Component } from '.';
import type { Position } from '../types';

type LerpValueType = number | Position;

interface LerpOptions<T extends LerpValueType> {
    get: () => T;
    set: (value: T) => void;
    speed: number;
    variant?: 'normal' | 'degrees';
}

export class C_Lerp<T extends LerpValueType> extends Component {
    #options: LerpOptions<T>;

    #currentValue: T;
    #targetValue: T;

    constructor(options: LerpOptions<T>) {
        super('Lerp');

        this.#options = options;

        this.#currentValue = this.#options.get();
        this.#targetValue = this.#options.get();
    }

    get target(): T {
        return this.#targetValue;
    }

    set target(value: T) {
        this.#targetValue = value;
    }

    override update(deltaTime: number): boolean {
        this.#currentValue = this.#options.get();
        if (this.#currentValue === this.#targetValue) {
            return false;
        }

        if (typeof this.#currentValue === 'number' && typeof this.#targetValue === 'number') {
            this.#currentValue = this.#lerp(this.#currentValue, this.#targetValue, deltaTime) as T;
        } else if (
            typeof this.#currentValue === 'object' &&
            typeof this.#targetValue === 'object'
        ) {
            this.#currentValue = {
                x: this.#lerp(this.#currentValue.x, this.#targetValue.x, deltaTime),
                y: this.#lerp(this.#currentValue.y, this.#targetValue.y, deltaTime),
            } as T;
        }

        this.#options.set(this.#currentValue);

        return true;
    }

    #lerp(current: number, target: number, deltaTime: number): number {
        if (this.#options.variant === 'degrees') {
            return (current + (target - current) * deltaTime * this.#options.speed) % 360;
        }

        const prevSign = current > target ? 1 : -1;
        const newValue = current - prevSign * deltaTime * this.#options.speed;
        const newSign = newValue > target ? 1 : -1;
        if (prevSign !== newSign) {
            return target;
        }

        return newValue;
    }
}
