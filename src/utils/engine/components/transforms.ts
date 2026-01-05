import { Component, type ComponentOptions } from '.';
import { Vector, type VectorConstructor } from '../math';
import type { BoundingBox } from '../types';

export interface C_TransformOptions extends ComponentOptions {
    position: VectorConstructor;
    rotation: number;
    scale: VectorConstructor;
}

export class C_Transform extends Component {
    #position: Vector = new Vector(0);
    #rotation: number = 0;
    #scale: Vector = new Vector(1);

    #positionOffset: Vector = new Vector(0);
    #scaleMult: Vector = new Vector(1);

    #localMatrix: DOMMatrix = new DOMMatrix();
    #localMatrixDirty: boolean = true;

    #worldMatrix: DOMMatrix = new DOMMatrix();
    #worldMatrixDirty: boolean = true;
    #worldPosition: Vector = new Vector(0);

    #boundingBox: BoundingBox = { x1: 0, x2: 0, y1: 0, y2: 0 };
    #boundingBoxDirty: boolean = true;
    #corners: [DOMPoint, DOMPoint, DOMPoint, DOMPoint] = [
        new DOMPoint(),
        new DOMPoint(),
        new DOMPoint(),
        new DOMPoint(),
    ];

    constructor(options: C_TransformOptions) {
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
        this.#worldPosition.x = this.worldMatrix.e;
        this.#worldPosition.y = this.worldMatrix.f;

        return this.#worldPosition;
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

    get localMatrix(): Readonly<DOMMatrix> {
        if (this.#localMatrixDirty) {
            this.#computeLocalMatrix();
            this.#localMatrixDirty = false;
        }

        return this.#localMatrix;
    }

    get worldMatrix(): Readonly<DOMMatrix> {
        if (this.#worldMatrixDirty) {
            this.#computeWorldMatrix();
            this.#boundingBoxDirty = true;
        }

        return this.#worldMatrix;
    }

    get boundingBox(): Readonly<BoundingBox> {
        if (this.#boundingBoxDirty) {
            this.#computeBoundingBox();
            this.#boundingBoxDirty = false;
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

    setPositionOffset(positionOffset: VectorConstructor): void {
        const x = typeof positionOffset === 'number' ? positionOffset : positionOffset.x;
        const y = typeof positionOffset === 'number' ? positionOffset : positionOffset.y;
        if (x !== this.#positionOffset.x || y !== this.#positionOffset.y) {
            this.#positionOffset.x = x;
            this.#positionOffset.y = y;
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
        // Why is there no easy reset function ._.
        const localMatrix = this.#localMatrix;
        localMatrix.a = 1;
        localMatrix.b = 0;
        localMatrix.c = 0;
        localMatrix.d = 1;
        localMatrix.e = 0;
        localMatrix.f = 0;

        localMatrix.translateSelf(
            this.#position.x + this.#positionOffset.x,
            this.#position.y + this.#positionOffset.y,
        );
        localMatrix.rotateSelf(this.#rotation);
        localMatrix.scaleSelf(this.#scale.x * this.#scaleMult.x, this.#scale.y * this.#scaleMult.y);
        this.#localMatrixDirty = false;
        this.#worldMatrixDirty = true;
    }

    #computeWorldMatrix() {
        if (this.entity.parent) {
            this.#worldMatrix = this.entity.parent.transform.worldMatrix.multiply(this.localMatrix);
        } else {
            this.#worldMatrix = this.localMatrix;
        }

        this.#boundingBoxDirty = true;
    }

    #computeBoundingBox() {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const comp of this.entity.components) {
            if (comp === this) continue;

            const compBB = comp.boundingBox;

            this.#corners[0].x = compBB.x1;
            this.#corners[0].y = compBB.y1;
            this.#corners[1].x = compBB.x2;
            this.#corners[1].y = compBB.y1;
            this.#corners[2].x = compBB.x2;
            this.#corners[2].y = compBB.y2;
            this.#corners[3].x = compBB.x1;
            this.#corners[3].y = compBB.y2;

            for (const corner of this.#corners) {
                const worldCorner = this.worldMatrix.transformPoint(corner);
                minX = Math.min(minX, worldCorner.x);
                maxX = Math.max(maxX, worldCorner.x);
                minY = Math.min(minY, worldCorner.y);
                maxY = Math.max(maxY, worldCorner.y);
            }
        }

        for (const child of this.entity.children) {
            const childBB = child.transform.boundingBox;
            minX = Math.min(minX, childBB.x1);
            maxX = Math.max(maxX, childBB.x2);
            minY = Math.min(minY, childBB.y1);
            maxY = Math.max(maxY, childBB.y2);
        }

        this.#boundingBox.x1 = minX;
        this.#boundingBox.y1 = minY;
        this.#boundingBox.x2 = maxX;
        this.#boundingBox.y2 = maxY;
    }

    #markLocalDirty() {
        this.#localMatrixDirty = true;
        this.markBoundingBoxDirty();
        for (const child of this.entity.children) {
            child.transform.#markWorldDirty();
        }
    }

    #markWorldDirty() {
        this.#worldMatrixDirty = true;
        this.markBoundingBoxDirty();
        for (const child of this.entity.children) {
            child.transform.#markWorldDirty();
        }
    }

    markBoundingBoxDirty() {
        if (!this.#boundingBoxDirty) {
            this.#boundingBoxDirty = true;
            if (this.entity.parent) {
                this.entity.parent.transform.markBoundingBoxDirty();
            }
        }
    }
}
