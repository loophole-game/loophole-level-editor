import { Component, type ComponentOptions } from '.';
import type { Engine } from '..';
import { Vector, type VectorConstructor } from '../math';
import type { BoundingBox } from '../types';

export interface C_TransformOptions<TEngine extends Engine = Engine>
    extends ComponentOptions<TEngine> {
    position: VectorConstructor;
    rotation: number;
    scale: VectorConstructor;
}

export class C_Transform<TEngine extends Engine = Engine> extends Component<TEngine> {
    #position: Vector = new Vector(0, 0);
    #rotation: number = 0;
    #scale: Vector = new Vector(1, 1);
    #scaleMult: Vector = new Vector(1, 1);
    #localMatrix: DOMMatrix = new DOMMatrix();
    #localMatrixDirty: boolean = true;

    #worldMatrix: DOMMatrix = new DOMMatrix();
    #worldMatrixDirty: boolean = true;

    #boundingBox: BoundingBox = { x1: 0, x2: 0, y1: 0, y2: 0 };
    #boundingBoxDirty: boolean = true;

    constructor(options: C_TransformOptions<TEngine>) {
        const { name = 'transform', ...rest } = options;
        super({
            name,
            ...rest,
        });
        this.#position = new Vector(options.position);
        this.#rotation = options.rotation;
        this.#scale = new Vector(options.scale);
    }

    get position(): Readonly<Vector> {
        return this.#position;
    }

    get worldPosition(): Readonly<Vector> {
        return new Vector(this.worldMatrix.e, this.#worldMatrix.f);
    }

    get rotation(): number {
        return this.#rotation;
    }

    get worldRotation(): number {
        const matrix = this.worldMatrix;
        return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
    }

    get scale(): Readonly<Vector> {
        return this.#scale;
    }

    get scaleMult(): Readonly<Vector> {
        return this.#scaleMult;
    }

    get worldScale(): Readonly<Vector> {
        const matrix = this.worldMatrix;
        return new Vector(
            Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b),
            Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d),
        );
    }

    get localMatrix(): Readonly<DOMMatrix> {
        if (this.#localMatrixDirty) {
            this.#computeLocalMatrix();
        }

        return this.#localMatrix;
    }

    get worldMatrix(): Readonly<DOMMatrix> {
        if (this.#worldMatrixDirty) {
            this.#computeWorldMatrix();
        }

        return this.#worldMatrix;
    }

    get boundingBox(): Readonly<BoundingBox> {
        if (this.#boundingBoxDirty) {
            this.#computeBoundingBox();
        }

        return this.#boundingBox;
    }

    setPosition(position: VectorConstructor): void {
        const x = typeof position === 'number' ? position : position.x;
        const y = typeof position === 'number' ? position : position.y;
        if (x !== this.#position.x || y !== this.#position.y) {
            this.#position.x = x;
            this.#position.y = y;
            this.#markLocalDirty();
        }
    }

    setRotation(rotation: number): void {
        if (rotation !== this.#rotation) {
            this.#rotation = rotation;
            this.#markLocalDirty();
        }
    }

    setScale(scale: VectorConstructor): void {
        const x = typeof scale === 'number' ? scale : scale.x;
        const y = typeof scale === 'number' ? scale : scale.y;
        if (x !== this.#scale.x || y !== this.#scale.y) {
            this.#scale.x = x;
            this.#scale.y = y;
            this.#markLocalDirty();
        }
    }

    setScaleMult(scaleMult: VectorConstructor): void {
        const x = typeof scaleMult === 'number' ? scaleMult : scaleMult.x;
        const y = typeof scaleMult === 'number' ? scaleMult : scaleMult.y;
        if (x !== this.#scaleMult.x || y !== this.#scaleMult.y) {
            this.#scaleMult.x = x;
            this.#scaleMult.y = y;
            this.#markLocalDirty();
        }
    }

    translate(delta: VectorConstructor): void {
        this.setPosition(this.#position.add(delta));
    }

    rotate(delta: number): void {
        this.setRotation(this.#rotation + delta);
    }

    scaleBy(delta: VectorConstructor): void {
        this.setScale(this.#scale.mul(delta));
    }

    #computeLocalMatrix() {
        this.#localMatrix = new DOMMatrix();
        this.#localMatrix.translateSelf(this.#position.x, this.#position.y);
        this.#localMatrix.rotateSelf(this.#rotation);
        this.#localMatrix.scaleSelf(
            this.#scale.x * this.#scaleMult.x,
            this.#scale.y * this.#scaleMult.y,
        );
        this.#localMatrixDirty = false;
        this.#worldMatrixDirty = true;
    }

    #computeWorldMatrix() {
        if (this.entity?.parent) {
            this.#worldMatrix = this.entity.parent.transform.worldMatrix.multiply(this.localMatrix);
        } else {
            this.#worldMatrix = this.localMatrix;
        }

        this.#worldMatrixDirty = false;
        this.#boundingBoxDirty = true;
    }

    #computeBoundingBox() {
        // Treat the transform as a unit rectangle (1x1) centered at origin
        // Get the 4 corners of this rectangle in local space
        const halfScaleX = 0.5;
        const halfScaleY = 0.5;

        const corners = [
            new DOMPoint(-halfScaleX, -halfScaleY),
            new DOMPoint(halfScaleX, -halfScaleY),
            new DOMPoint(halfScaleX, halfScaleY),
            new DOMPoint(-halfScaleX, halfScaleY),
        ];

        // Transform corners to world space
        const worldCorners = corners.map((corner) => this.worldMatrix.transformPoint(corner));

        // Find the axis-aligned bounding box that contains all corners
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const corner of worldCorners) {
            minX = Math.min(minX, corner.x);
            maxX = Math.max(maxX, corner.x);
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
        }

        this.#boundingBox = {
            x1: minX,
            x2: maxX,
            y1: minY,
            y2: maxY,
        };
        this.#boundingBoxDirty = false;
    }

    #markLocalDirty() {
        this.#localMatrixDirty = true;
        this.entity?.children.forEach((child) => {
            child.transform.#markWorldDirty();
        });
    }

    #markWorldDirty() {
        this.#worldMatrixDirty = true;
        this.#boundingBoxDirty = true;
        this.entity?.children.forEach((child) => {
            child.transform.#markWorldDirty();
        });
    }
}
