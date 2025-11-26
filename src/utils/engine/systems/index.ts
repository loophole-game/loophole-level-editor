import type { Engine } from '..';

export abstract class System<TEngine extends Engine = Engine> {
    protected _engine: TEngine;

    constructor(engine: TEngine) {
        this._engine = engine;
        this._engine.addSystem(this);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    abstract destroy(): void;
}
