export interface IVector<T> {
    x: T;
    y: T;
}

export type VectorConstructor<T = number> = T | IVector<T>;

/**
 * A 2D vector class for position, direction, and scale operations.
 * This class is designed to be efficient while providing convenience methods
 * for common vector operations.
 */
export class Vector implements IVector<number> {
    x: number;
    y: number;

    constructor(x: VectorConstructor, y?: number) {
        if (typeof x === 'number' && typeof y === 'number') {
            this.x = x;
            this.y = y;
        } else if (typeof x === 'number' && y === undefined) {
            this.x = this.y = x;
        } else if (x && typeof x === 'object' && 'x' in x && 'y' in x) {
            this.x = x.x;
            this.y = x.y;
        } else {
            this.x = 0;
            this.y = 0;
        }
    }

    // ==================== Static Factory Methods ====================

    /** Creates a zero vector (0, 0) */
    static zero(): Vector {
        return new Vector(0);
    }

    /** Creates a unit vector (1, 1) */
    static one(): Vector {
        return new Vector(1);
    }

    /** Creates a vector from an angle (in radians) and optional magnitude */
    static fromAngle(radians: number, magnitude: number = 1): Vector {
        return new Vector(Math.cos(radians) * magnitude, Math.sin(radians) * magnitude);
    }

    /** Linearly interpolates between two vectors */
    static lerp(from: Vector, to: Vector, t: number): Vector {
        return new Vector(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }

    /** Returns the minimum components of two vectors */
    static min(a: Vector, b: Vector): Vector {
        return new Vector(Math.min(a.x, b.x), Math.min(a.y, b.y));
    }

    /** Returns the maximum components of two vectors */
    static max(a: Vector, b: Vector): Vector {
        return new Vector(Math.max(a.x, b.x), Math.max(a.y, b.y));
    }

    /** Returns the distance between two vectors */
    static distance(a: Vector, b: Vector): number {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    /** Returns the squared distance between two vectors (faster than distance) */
    static distanceSquared(a: Vector, b: Vector): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return dx * dx + dy * dy;
    }

    /** Checks if two vectors are equal */
    static equals(a: Vector, b: Vector): boolean {
        return a.x === b.x && a.y === b.y;
    }

    // ==================== Instance Methods (Immutable - return new Vector) ====================

    extract(): IVector<number> {
        return { x: this.x, y: this.y };
    }

    clone(): Vector {
        return new Vector(this.x, this.y);
    }

    /** Returns a new vector that is the sum of this and another vector */
    add(other: VectorConstructor): Vector {
        if (typeof other === 'number') {
            return new Vector(this.x + other, this.y + other);
        } else {
            return new Vector(this.x + other.x, this.y + other.y);
        }
    }

    /** Returns a new vector that is the difference of this and another vector */
    sub(other: VectorConstructor): Vector {
        if (typeof other === 'number') {
            return new Vector(this.x - other, this.y - other);
        } else {
            return new Vector(this.x - other.x, this.y - other.y);
        }
    }

    /** Returns a new vector with components multiplied by the other vector's components */
    mul(other: VectorConstructor): Vector {
        if (typeof other === 'number') {
            return new Vector(this.x * other, this.y * other);
        } else {
            return new Vector(this.x * other.x, this.y * other.y);
        }
    }

    /** Returns a new vector with components divided by the other vector's components */
    div(other: VectorConstructor): Vector {
        if (typeof other === 'number') {
            return new Vector(this.x / other, this.y / other);
        } else {
            return new Vector(this.x / other.x, this.y / other.y);
        }
    }

    /** Returns a new vector scaled by another value */
    scaleBy(other: VectorConstructor): Vector {
        if (typeof other === 'number') {
            return new Vector(this.x * other, this.y * other);
        } else {
            return new Vector(this.x * other.x, this.y * other.y);
        }
    }

    /** Returns the dot product of this and another vector */
    dot(other: VectorConstructor): number {
        if (typeof other === 'number') {
            return this.x * other + this.y * other;
        } else {
            return this.x * other.x + this.y * other.y;
        }
    }

    /** Returns the 2D cross product (z-component of 3D cross product) */
    cross(other: VectorConstructor): number {
        if (typeof other === 'number') {
            return this.x * other - this.y * other;
        } else {
            return this.x * other.y - this.y * other.x;
        }
    }

    /** Returns the length (magnitude) of this vector */
    length(): number {
        return Math.hypot(this.x, this.y);
    }

    /** Returns the squared length of this vector (faster than length) */
    lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    /** Returns a normalized (unit length) version of this vector */
    normalize(): Vector {
        const len = this.length();
        if (len === 0) return new Vector(0, 0);
        return new Vector(this.x / len, this.y / len);
    }

    /** Returns the distance to another vector */
    distanceTo(other: VectorConstructor): number {
        if (typeof other === 'number') {
            return Math.hypot(other - this.x, other - this.y);
        } else {
            return Math.hypot(other.x - this.x, other.y - this.y);
        }
    }

    /** Returns the squared distance to another vector (faster than distanceTo) */
    distanceSquaredTo(other: VectorConstructor): number {
        if (typeof other === 'number') {
            return (other - this.x) * (other - this.x) + (other - this.y) * (other - this.y);
        } else {
            return (
                (other.x - this.x) * (other.x - this.x) + (other.y - this.y) * (other.y - this.y)
            );
        }
    }

    /** Checks if this vector equals another vector */
    equals(other: VectorConstructor, precision: number = 0.00001): boolean {
        if (typeof other === 'number') {
            return Math.abs(this.x - other) < precision && Math.abs(this.y - other) < precision;
        } else {
            return Math.abs(this.x - other.x) < precision && Math.abs(this.y - other.y) < precision;
        }
    }

    /** Returns a negated version of this vector */
    negate(): Vector {
        return new Vector(-this.x, -this.y);
    }

    /** Returns a new vector with components floored */
    floor(): Vector {
        return new Vector(Math.floor(this.x), Math.floor(this.y));
    }

    /** Returns a new vector with components rounded */
    round(): Vector {
        return new Vector(Math.round(this.x), Math.round(this.y));
    }

    /** Returns a new vector with components ceiled */
    ceil(): Vector {
        return new Vector(Math.ceil(this.x), Math.ceil(this.y));
    }

    /** Returns a new vector with absolute values */
    abs(): Vector {
        return new Vector(Math.abs(this.x), Math.abs(this.y));
    }

    /** Returns the angle of this vector in radians */
    angle(): number {
        return Math.atan2(this.y, this.x);
    }

    /** Returns a rotated version of this vector by the given angle in radians */
    rotate(radians: number): Vector {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return new Vector(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }

    /** Returns a vector with components clamped between min and max vectors */
    clamp(min: IVector<number>, max: IVector<number>): Vector {
        return new Vector(
            Math.max(min.x, Math.min(max.x, this.x)),
            Math.max(min.y, Math.min(max.y, this.y)),
        );
    }

    // ==================== Instance Methods (Mutable - modify in place) ====================

    /** Sets the x and y components */
    set(other: VectorConstructor): boolean {
        if (typeof other === 'number') {
            if (this.x === other && this.y === other) {
                return false;
            }

            this.x = other;
            this.y = other;
        } else {
            if (this.x === other.x && this.y === other.y) {
                return false;
            }

            this.x = other.x;
            this.y = other.y;
        }

        return true;
    }

    /** Adds another vector to this one (mutates) */
    addMut(other: VectorConstructor): this {
        if (typeof other === 'number') {
            this.x += other;
            this.y += other;
        } else {
            this.x += other.x;
            this.y += other.y;
        }

        return this;
    }

    /** Subtracts another vector from this one (mutates) */
    subMut(other: VectorConstructor): this {
        if (typeof other === 'number') {
            this.x -= other;
            this.y -= other;
        } else {
            this.x -= other.x;
            this.y -= other.y;
        }

        return this;
    }

    /** Multiplies this vector by another value (mutates) */
    mulMut(other: VectorConstructor): this {
        if (typeof other === 'number') {
            this.x *= other;
            this.y *= other;
        } else {
            this.x *= other.x;
            this.y *= other.y;
        }

        return this;
    }

    /** Divides this vector by another value (mutates) */
    divMut(other: VectorConstructor): this {
        if (typeof other === 'number') {
            this.x /= other;
            this.y /= other;
        } else {
            this.x /= other.x;
            this.y /= other.y;
        }

        return this;
    }

    /** Scales this vector by another value (mutates) */
    scaleMut(other: VectorConstructor): this {
        if (typeof other === 'number') {
            this.x *= other;
            this.y *= other;
        } else {
            this.x *= other.x;
            this.y *= other.y;
        }

        return this;
    }

    /** Normalizes this vector (mutates) */
    normalizeMut(): this {
        const len = this.length();
        if (len !== 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    /** Negates this vector (mutates) */
    negateMut(): this {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    /** Floors the components (mutates) */
    floorMut(): this {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    }

    /** Rounds the components (mutates) */
    roundMut(): this {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }

    /** Ceils the components (mutates) */
    ceilMut(): this {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    }

    /** Converts to absolute values (mutates) */
    absMut(): this {
        this.x = Math.abs(this.x);
        this.y = Math.abs(this.y);
        return this;
    }

    // ==================== Conversion Methods ====================

    /** Converts to a plain object */
    toObject(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /** Converts to an array [x, y] */
    toArray(): [number, number] {
        return [this.x, this.y];
    }

    /** String representation */
    toString(): string {
        return `Vector(${this.x}, ${this.y})`;
    }
}
