import { Component } from '.';
import type { Position } from '../types';
import { vectorOrNumberToVector } from '../utils';

export class C_Transform extends Component {
    #position: Position = { x: 0, y: 0 };
    #rotation: number = 0;
    #scale: Position = { x: 1, y: 1 };
    #scaleMult: Position = { x: 1, y: 1 };
    #localMatrix: DOMMatrix = new DOMMatrix();
    #localMatrixDirty: boolean = true;

    #worldMatrix: DOMMatrix = new DOMMatrix();
    #worldMatrixDirty: boolean = true;

    constructor(position: number | Position, rotation: number, scale: number | Position) {
        super('Transform');
        this.#position = vectorOrNumberToVector(position);
        this.#rotation = rotation;
        this.#scale = vectorOrNumberToVector(scale);
    }

    get position(): Readonly<Position> {
        return this.#position;
    }

    get worldPosition(): Readonly<Position> {
        return {
            x: this.worldMatrix.e,
            y: this.#worldMatrix.f,
        };
    }

    get rotation(): number {
        return this.#rotation;
    }

    get worldRotation(): number {
        const matrix = this.worldMatrix;
        return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
    }

    get scale(): Readonly<Position> {
        return this.#scale;
    }

    get scaleMult(): Readonly<Position> {
        return this.#scaleMult;
    }

    get worldScale(): Readonly<Position> {
        const matrix = this.worldMatrix;
        return {
            x: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b),
            y: Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d),
        };
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

    setPosition(position: Position): void {
        if (position.x !== this.#position.x || position.y !== this.#position.y) {
            this.#position = { ...position };
            this.#markLocalDirty();
        }
    }

    setRotation(rotation: number): void {
        if (rotation !== this.#rotation) {
            this.#rotation = rotation;
            this.#markLocalDirty();
        }
    }

    setScale(scale: Position): void {
        if (scale.x !== this.#scale.x || scale.y !== this.#scale.y) {
            this.#scale = { ...scale };
            this.#markLocalDirty();
        }
    }

    setScaleMult(scaleMult: Position): void {
        if (scaleMult.x !== this.#scaleMult.x || scaleMult.y !== this.#scaleMult.y) {
            this.#scaleMult = { ...scaleMult };
            this.#markLocalDirty();
        }
    }

    translate(delta: Position): void {
        this.setPosition({
            x: this.#position.x + delta.x,
            y: this.#position.y + delta.y,
        });
    }

    rotate(delta: number): void {
        this.setRotation(this.#rotation + delta);
    }

    scaleBy(delta: Position): void {
        this.setScale({
            x: this.#scale.x * delta.x,
            y: this.#scale.y * delta.y,
        });
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
