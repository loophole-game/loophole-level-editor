import type { Engine } from '..';

export abstract class System {
    protected _engine: Engine;

    constructor(engine: Engine) {
        this._engine = engine;
        this._engine.addSystem(this);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    abstract destroy(): void;
}
