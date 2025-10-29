import { Component } from '.';
import type { Position } from '../types';
import { positionsEqual } from '../utils';

type LerpValueType = number | Position;

interface LerpOptions<T extends LerpValueType> {
    get: () => T;
    set: (value: T) => void;
    speed: number;
    variant?: 'normal' | 'degrees';
    type?: 'linear' | 'fractional';
}

export class C_Lerp<T extends LerpValueType> extends Component {
    #options: LerpOptions<T>;

    #targetValue: T;

    constructor(options: LerpOptions<T>) {
        super('Lerp');

        this.#options = options;

        this.#targetValue = this.#options.get();
    }

    get target(): T {
        return this.#targetValue;
    }

    set target(value: T) {
        this.#targetValue = value;
    }

    override update(deltaTime: number): boolean {
        let currentValue = this.#options.get();
        if (typeof currentValue === 'number' && typeof this.#targetValue === 'number') {
            if (currentValue === this.#targetValue) {
                return false;
            }

            currentValue = this.#lerp(currentValue, this.#targetValue, deltaTime) as T;
        } else if (typeof currentValue === 'object' && typeof this.#targetValue === 'object') {
            if (positionsEqual(currentValue, this.#targetValue)) {
                return false;
            }

            currentValue = {
                x: this.#lerp(currentValue.x, this.#targetValue.x, deltaTime),
                y: this.#lerp(currentValue.y, this.#targetValue.y, deltaTime),
            } as T;
        }

        this.#options.set(currentValue);

        return true;
    }

    #lerp(current: number, target: number, deltaTime: number): number {
        return this.#options.type === 'fractional'
            ? this.#lerpFractional(current, target, deltaTime)
            : this.#lerpLinear(current, target, deltaTime);
    }

    #lerpLinear(current: number, target: number, deltaTime: number): number {
        if (this.#options.variant === 'degrees') {
            // Normalize angles to be within 0-360 degrees
            const startAngle = ((current % 360) + 360) % 360;
            const endAngle = ((target % 360) + 360) % 360;

            let delta = endAngle - startAngle;

            // Adjust delta to take the shortest path
            if (delta > 180) {
                delta -= 360;
            } else if (delta < -180) {
                delta += 360;
            }

            const step = deltaTime * this.#options.speed;

            // If the step would overshoot (or exactly reach) the target, snap to target
            if (step >= Math.abs(delta)) {
                return target;
            }

            // Perform linear interpolation toward the shortest direction
            const interpolatedAngle = startAngle + step * Math.sign(delta);

            return ((interpolatedAngle % 360) + 360) % 360;
        }

        const prevSign = current > target ? 1 : -1;
        const newValue = current - prevSign * deltaTime * this.#options.speed;
        const newSign = newValue > target ? 1 : -1;
        if (prevSign !== newSign) {
            return target;
        }

        return newValue;
    }

    #lerpFractional(current: number, target: number, deltaTime: number): number {
        const mult = deltaTime * this.#options.speed;
        if (mult >= 1) {
            return target;
        }

        return current + (target - current) * deltaTime * this.#options.speed;
    }
}
