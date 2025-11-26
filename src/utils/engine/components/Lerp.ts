import { Component, type ComponentOptions } from '.';
import type { Engine } from '..';
import { type IVector } from '../math';

type LerpValueType = number | IVector<number>;

interface C_LerpOptions<T extends LerpValueType, TEngine extends Engine = Engine>
    extends ComponentOptions<TEngine> {
    get: () => T;
    set: (value: T) => void;
    speed: number;
    variant?: 'normal' | 'degrees';
    type?: 'linear' | 'fractional';
}

const SNAP_EPSILON = 1e-6;
const BASELINE_RATE = 1e-3;

export class C_Lerp<
    T extends LerpValueType,
    TEngine extends Engine = Engine,
> extends Component<TEngine> {
    #get: () => T;
    #set: (value: T) => void;
    #speed: number;
    #variant: 'normal' | 'degrees';
    #type: 'linear' | 'fractional';

    #targetValue: T;

    constructor(options: C_LerpOptions<T, TEngine>) {
        const { name = 'lerp', ...rest } = options;
        super({ name, ...rest });

        this.#get = options.get;
        this.#set = options.set;
        this.#speed = options.speed;
        this.#variant = options.variant ?? 'normal';
        this.#type = options.type ?? 'linear';

        this.#targetValue = this.#get();
    }

    get target(): T {
        return this.#targetValue;
    }

    set target(value: T) {
        this.#targetValue = value;
    }

    override update(deltaTime: number): boolean {
        let currentValue = this.#get();
        if (typeof currentValue === 'number' && typeof this.#targetValue === 'number') {
            if (currentValue === this.#targetValue) {
                return false;
            }

            currentValue = this.#lerp(currentValue, this.#targetValue, deltaTime) as T;
        } else if (typeof currentValue === 'object' && typeof this.#targetValue === 'object') {
            if (currentValue.x === this.#targetValue.x && currentValue.y === this.#targetValue.y) {
                return false;
            }

            currentValue = {
                x: this.#lerp(currentValue.x, this.#targetValue.x, deltaTime),
                y: this.#lerp(currentValue.y, this.#targetValue.y, deltaTime),
            } as T;
        }

        this.#set(currentValue);

        return true;
    }

    #lerp(current: number, target: number, deltaTime: number): number {
        return this.#type === 'fractional'
            ? this.#lerpFractional(current, target, deltaTime)
            : this.#lerpLinear(current, target, deltaTime);
    }

    #lerpLinear(current: number, target: number, deltaTime: number): number {
        if (this.#variant === 'degrees') {
            const startAngle = ((current % 360) + 360) % 360;
            const endAngle = ((target % 360) + 360) % 360;

            let delta = endAngle - startAngle;

            if (delta > 180) {
                delta -= 360;
            } else if (delta < -180) {
                delta += 360;
            }

            const step = deltaTime * this.#speed;

            if (step >= Math.abs(delta)) {
                return target;
            }

            const interpolatedAngle = startAngle + step * Math.sign(delta);

            return ((interpolatedAngle % 360) + 360) % 360;
        }

        const prevSign = current > target ? 1 : -1;
        const newValue = current - prevSign * deltaTime * this.#speed;
        const newSign = newValue > target ? 1 : -1;
        if (prevSign !== newSign) {
            return target;
        }

        return newValue;
    }

    #lerpFractional(current: number, target: number, deltaTime: number): number {
        const mult = deltaTime * this.#speed;
        if (mult >= 1) {
            return target;
        }

        const delta = target - current;
        if (Math.abs(delta) <= SNAP_EPSILON) {
            return target;
        }

        let step = delta * mult;
        const minStep = BASELINE_RATE * deltaTime;
        if (Math.abs(step) < minStep) {
            step = Math.sign(delta) * Math.min(minStep, Math.abs(delta));
        }

        const next = current + step;
        if (
            (delta > 0 && next >= target) ||
            (delta < 0 && next <= target) ||
            Math.abs(target - next) <= SNAP_EPSILON
        ) {
            return target;
        }

        return next;
    }
}

interface OpacityLerpOptions<TEngine extends Engine = Engine>
    extends Omit<C_LerpOptions<number, TEngine>, 'get' | 'set'> {
    target: { style: { globalAlpha?: number } };
}

export class C_LerpOpacity<TEngine extends Engine = Engine> extends C_Lerp<number, TEngine> {
    constructor(options: OpacityLerpOptions<TEngine>) {
        const { name = 'opacity_lerp', target, ...rest } = options;
        super({
            name,
            get: () => target.style.globalAlpha ?? 0,
            set: (value: number) => {
                target.style.globalAlpha = value;
            },
            ...rest,
        });
    }
}

interface PositionLerpOptions<V extends IVector<number>, TEngine extends Engine = Engine>
    extends Omit<C_LerpOptions<V, TEngine>, 'get' | 'set'> {
    target: { position: V; setPosition?: (value: V) => void };
}

export class C_LerpPosition<
    V extends IVector<number>,
    TEngine extends Engine = Engine,
> extends C_Lerp<V, TEngine> {
    constructor(options: PositionLerpOptions<V, TEngine>) {
        const { name = 'position_lerp', target, ...rest } = options;
        super({
            name,
            get: () => target.position,
            set: (value: V) => {
                if (target.setPosition) {
                    target.setPosition(value);
                } else {
                    target.position = value;
                }
            },
            ...rest,
        });
    }
}

interface RotationLerpOptions<TEngine extends Engine = Engine>
    extends Omit<C_LerpOptions<number, TEngine>, 'get' | 'set'> {
    target: { rotation: number; setRotation?: (value: number) => void };
}

export class C_LerpRotation<TEngine extends Engine = Engine> extends C_Lerp<number, TEngine> {
    constructor(options: RotationLerpOptions<TEngine>) {
        const { name = 'rotation_lerp', variant = 'degrees', target, ...rest } = options;
        super({
            name,
            get: () => target.rotation,
            set: (value: number) => {
                if (target.setRotation) {
                    target.setRotation(value);
                } else {
                    target.rotation = value;
                }
            },
            variant,
            ...rest,
        });
    }
}
