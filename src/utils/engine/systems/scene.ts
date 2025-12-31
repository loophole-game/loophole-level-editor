import { System } from '.';
import type { Engine } from '..';
import { Entity, type EntityOptions } from '../entities';

const DEFAULT_SCENE_NAME = 'default-scene';

export interface SceneOptions<TEngine extends Engine = Engine> {
    engine: TEngine;
    name?: string;
    zIndex?: number;
}

export class Scene<TEngine extends Engine = Engine> {
    protected static _nextId: number = 1;
    protected readonly _id: number = Scene._nextId++;
    protected readonly _name: string;

    protected _engine: TEngine;
    #rootEntity: Entity | null = null;
    #zIndex: number = 0;

    constructor(options: SceneOptions<TEngine>) {
        const { engine, name, zIndex = 0 } = options;
        this._engine = engine;
        this._name = name || `scene-${this._id}`;
        this.#zIndex = zIndex;
    }

    get id(): number {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get zIndex(): number {
        return this.#zIndex;
    }

    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex && !isNaN(zIndex)) {
            this.#zIndex = zIndex;
            if (this.#rootEntity) {
                this.#rootEntity.setZIndex(zIndex);
            }
        }
    }

    get engine(): Engine | null {
        return this._engine;
    }

    get rootEntity(): Readonly<Entity> | null {
        return this.#rootEntity;
    }

    set rootEntity(rootEntity: Entity | null) {
        this.#rootEntity = rootEntity;
    }

    add<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, options: Omit<TOptions, 'engine'>): T;
    add<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, ...optionObjs: Omit<TOptions, 'engine'>[]): T[];
    add<
        T extends Entity<TEngine>,
        TOptions extends EntityOptions<TEngine> = EntityOptions<TEngine>,
    >(ctor: new (options: TOptions) => T, ...optionObjs: Omit<TOptions, 'engine'>[]): T | T[] {
        const instances = (optionObjs.length > 0 ? optionObjs : [{}]).map((option) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entity = new ctor({ ...option, engine: this._engine, scene: this.name } as any);
            this.engine?.sceneSystem.registerEntities(this.name, entity);
            return entity;
        });
        return instances.length === 1 ? instances[0] : instances;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create(_engine: TEngine): void {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    destroy(): void {}
}

export type SceneIdentifier<TEngine extends Engine = Engine> =
    | Scene<TEngine>
    | string
    | number
    | null;

export class SceneSystem<TEngine extends Engine = Engine> extends System<TEngine> {
    #queuedNewScenes: Scene<TEngine>[] = [];
    #activeScenesByID: Map<number, Scene<TEngine>> = new Map();
    #activeScenesByName: Map<string, Scene<TEngine>> = new Map();
    #defaultScene: Scene<TEngine> | null = null;

    #queuedDestroyedScenes: Scene<TEngine>[] = [];
    #isLoadingQueuedScenes: boolean = false;

    #worldRootEntity: Entity<TEngine>;
    #sceneRootEntities: Map<number, Entity<TEngine>> = new Map();

    constructor(engine: TEngine, worldRootEntity: Entity<TEngine>) {
        super(engine);

        this.#worldRootEntity = worldRootEntity;
    }

    get queuedActionsExist(): boolean {
        return this.#queuedNewScenes.length > 0 || this.#queuedDestroyedScenes.length > 0;
    }

    override earlyUpdate(deltaTime: number): boolean {
        let updated = this.#performQueuedUpdate();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_, scene] of this.#activeScenesByID) {
            updated = scene.update(deltaTime) || updated;
        }

        return updated;
    }

    destroy(): void {
        this.#queuedNewScenes = [];
        this.#activeScenesByID.clear();
        this.#activeScenesByName.clear();
        this.#defaultScene = null;
        this.#queuedDestroyedScenes = [];
    }

    openScene(scene: Scene<TEngine>): void {
        this.#queuedNewScenes.push(scene);
    }

    closeScene(scene: SceneIdentifier<TEngine>): void {
        const sceneObject = this.#findScene(scene);
        if (!sceneObject) {
            return;
        }

        this.#activeScenesByID.delete(sceneObject.id);
        this.#activeScenesByName.delete(sceneObject.name);
        this.#queuedDestroyedScenes.push(sceneObject);
    }

    registerEntities(scene: SceneIdentifier<TEngine>, ...entities: Entity<TEngine>[]): void {
        if (this.queuedActionsExist && !this.#isLoadingQueuedScenes) {
            this.#performQueuedUpdate();
        }

        let sceneObject = this.#findScene(scene);
        if (!sceneObject) {
            this.#defaultScene = new Scene({ engine: this._engine, name: DEFAULT_SCENE_NAME });
            this.#makeSceneActive(this.#defaultScene);
            sceneObject = this.#defaultScene;
        }

        const rootEntity = this.#sceneRootEntities.get(sceneObject.id);
        if (!rootEntity) {
            throw new Error(`Scene root entity for ${sceneObject.name} not found`);
        }

        for (const entity of entities) {
            entity.parent = rootEntity;
        }
    }

    #findScene(scene: SceneIdentifier<TEngine>): Scene<TEngine> | null {
        if (this.queuedActionsExist && !this.#isLoadingQueuedScenes) {
            this.#performQueuedUpdate();
        }

        return (
            (!scene
                ? this.#defaultScene
                : typeof scene === 'string'
                  ? this.#activeScenesByName.get(scene)
                  : typeof scene === 'number'
                    ? this.#activeScenesByID.get(scene)
                    : scene) || this.#defaultScene
        );
    }

    #makeSceneActive(scene: Scene<TEngine>): void {
        this.#activeScenesByID.set(scene.id, scene);
        this.#activeScenesByName.set(scene.name, scene);

        const rootEntity = this.#worldRootEntity.addEntities(Entity<TEngine>, {
            name: `scene-root-${scene.name}-${scene.id}`,
            zIndex: scene.zIndex,
            cull: 'none',
        });
        this.#sceneRootEntities.set(scene.id, rootEntity);
        if (!this.#defaultScene) {
            this.#defaultScene = scene;
        }

        scene.rootEntity = rootEntity;
        scene.create(this._engine);
    }

    #performQueuedUpdate(): boolean {
        let updated = false;
        this.#isLoadingQueuedScenes = true;

        while (this.#queuedNewScenes.length > 0) {
            const newScenes = [...this.#queuedNewScenes];
            // Allows new scenes to be opened by a scene's create method
            this.#queuedNewScenes = [];
            for (const newScene of newScenes) {
                this.#makeSceneActive(newScene);
            }
            updated = true;
        }

        for (const scene of this.#queuedDestroyedScenes) {
            scene.destroy();
            const rootEntity = this.#sceneRootEntities.get(scene.id);
            if (rootEntity) {
                rootEntity.destroy();
            }
            updated = true;
        }
        this.#queuedDestroyedScenes = [];
        this.#isLoadingQueuedScenes = false;

        return updated;
    }
}
