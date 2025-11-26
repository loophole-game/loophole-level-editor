import { Component } from '.';
import { Vector, type VectorConstructor } from '../math';

export class C_Transform extends Component {
    #position: Vector = new Vector(0, 0);
    #rotation: number = 0;
    #scale: Vector = new Vector(1, 1);
    #scaleMult: Vector = new Vector(1, 1);
    #localMatrix: DOMMatrix = new DOMMatrix();
    #localMatrixDirty: boolean = true;

    #worldMatrix: DOMMatrix = new DOMMatrix();
    #worldMatrixDirty: boolean = true;

    constructor(position: VectorConstructor, rotation: number, scale: VectorConstructor) {
        super('Transform');
        this.#position = new Vector(position);
        this.#rotation = rotation;
        this.#scale = new Vector(scale);
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
    }

    #markLocalDirty() {
        this.#localMatrixDirty = true;
        this.entity?.children.forEach((child) => {
            child.transform.#markWorldDirty();
        });
    }

    #markWorldDirty() {
        this.#worldMatrixDirty = true;
        this.entity?.children.forEach((child) => {
            child.transform.#markWorldDirty();
        });
    }
}
