import { System } from '.';
import type { Engine } from '..';
import { Entity } from '../entities';

const DEFAULT_SCENE_NAME = 'default-scene';

export type AvailableScenes = Record<string, (name?: string) => Scene>;

export class Scene {
    protected static _nextId: number = 1;
    protected readonly _id: number = Scene._nextId++;
    protected readonly _name: string;

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

    get rootEntity(): Readonly<Entity> | null {
        return this.#rootEntity;
    }

    set rootEntity(rootEntity: Entity | null) {
        this.#rootEntity = rootEntity;
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

    addEntities(...entities: Entity[]): void {
        this.#rootEntity?.addChildren(...entities);
    }
}

export type SceneIdentifier = Scene | string | number | null;

export class SceneSystem extends System {
    #queuedNewScenes: Scene[] = [];
    #activeScenesByID: Map<number, Scene> = new Map();
    #activeScenesByName: Map<string, Scene> = new Map();
    #defaultScene: Scene | null = null;

    #queuedDestroyedScenes: Scene[] = [];

    #worldRootEntity: Entity;
    #sceneRootEntities: Map<number, Entity> = new Map();

    constructor(engine: Engine, worldRootEntity: Entity) {
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

    createScene(scene: Scene): void {
        this.#queuedNewScenes.push(scene);
    }

    destroyScene(scene: SceneIdentifier): void {
        const sceneObject = this.#findScene(scene);
        if (!sceneObject) {
            return;
        }

        this.#activeScenesByID.delete(sceneObject.id);
        this.#activeScenesByName.delete(sceneObject.name);
        this.#queuedDestroyedScenes.push(sceneObject);
    }

    addEntities(scene: SceneIdentifier, ...entities: Entity[]): void {
        if (this.queuedActionsExist) {
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

        rootEntity.addChildren(...entities);
    }

    #findScene(scene: SceneIdentifier): Scene | null {
        if (this.queuedActionsExist) {
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

    #makeSceneActive(scene: Scene): void {
        this.#activeScenesByID.set(scene.id, scene);
        this.#activeScenesByName.set(scene.name, scene);

        const rootEntity = new Entity(`scene-root-${scene.name}-${scene.id}`);
        this.#worldRootEntity.addChildren(rootEntity);
        this.#sceneRootEntities.set(scene.id, rootEntity);
        if (!this.#defaultScene) {
            this.#defaultScene = scene;
        }

        scene.rootEntity = rootEntity;
        scene.create(this._engine);
    }

    #performQueuedUpdate(): boolean {
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

        return updated;
    }
}
