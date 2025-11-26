import { System } from '.';
import type { Engine } from '..';
import { Entity, type EntityOptions } from '../entities';

const DEFAULT_SCENE_NAME = 'default-scene';

export type AvailableScenes = Record<string, (name?: string) => Scene>;

export class Scene<TEngine extends Engine = Engine> {
    protected static _nextId: number = 1;
    protected readonly _id: number = Scene._nextId++;
    protected readonly _name: string;

    protected _engine: TEngine | null = null;
    #rootEntity: Entity | null = null;

    constructor(name?: string) {
        this._name = name || `scene-${this._id}`;
    }

    get id(): number {
        return this._id;
    }

    get name(): string {
        return this._name;
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
    create(_engine: Engine): void {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(_deltaTime: number): boolean {
        return false;
    }

    destroy(): void {
        return;
    }
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

    update(deltaTime: number): boolean {
        let updated = this.#performQueuedUpdate();

        this.#activeScenesByID.forEach((scene) => {
            updated = scene.update(deltaTime) || updated;
        });

        return updated;
    }

    destroy(): void {
        this.#queuedNewScenes = [];
        this.#activeScenesByID.clear();
        this.#activeScenesByName.clear();
        this.#defaultScene = null;
        this.#queuedDestroyedScenes = [];
    }

    createScene(scene: Scene<TEngine>): void {
        this.#queuedNewScenes.push(scene);
    }

    destroyScene(scene: SceneIdentifier<TEngine>): void {
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
            this.#defaultScene = new Scene(DEFAULT_SCENE_NAME);
            this.#makeSceneActive(this.#defaultScene);
            sceneObject = this.#defaultScene;
        }

        const rootEntity = this.#sceneRootEntities.get(sceneObject.id);
        if (!rootEntity) {
            throw new Error(`Scene root entity for ${sceneObject.name} not found`);
        }

        entities.forEach((e) => (e.parent = rootEntity));
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
                    : scene) || null
        );
    }

    #makeSceneActive(scene: Scene<TEngine>): void {
        this.#activeScenesByID.set(scene.id, scene);
        this.#activeScenesByName.set(scene.name, scene);

        const rootEntity = this.#worldRootEntity.addEntities(Entity<TEngine>, {
            name: `scene-root-${scene.name}-${scene.id}`,
        });
        this.#sceneRootEntities.set(scene.id, rootEntity);
        if (!this.#defaultScene) {
            this.#defaultScene = scene;
        }

        scene.rootEntity = rootEntity;
        scene.create(this._engine);
    }

    #performQueuedUpdate(): boolean {
        this.#isLoadingQueuedScenes = true;
        this.#queuedNewScenes.forEach((scene) => {
            this.#makeSceneActive(scene);
        });
        this.#queuedNewScenes = [];

        let updated = false;

        this.#queuedDestroyedScenes.forEach((scene) => {
            scene.destroy();
            const rootEntity = this.#sceneRootEntities.get(scene.id);
            if (rootEntity) {
                rootEntity.destroy();
            }
            updated = true;
        });
        this.#queuedDestroyedScenes = [];
        this.#isLoadingQueuedScenes = false;

        return updated;
    }
}
