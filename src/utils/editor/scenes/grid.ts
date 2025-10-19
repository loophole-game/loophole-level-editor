import { C_Shape } from '../../engine/components/Shape';
import { Entity } from '../../engine/entities';
import { Scene } from '../../engine/systems/scene';
import { TILE_SIZE } from '../constants';

const GRID_BUFFER = 2;

class E_Grid extends Entity {
    #shapeComponent: C_Shape;

    constructor() {
        const comp = new C_Shape(
            'cursor',
            'RECT',
            {
                strokeStyle: 'lightgrey',
                fillStyle: 'darkgrey',
                lineWidth: 2,
            },
            { x: 1, y: 1 },
        );

        super('grid', comp);
        this.#shapeComponent = comp;
        this.setScale({ x: TILE_SIZE, y: TILE_SIZE });
    }

    override update(): boolean {
        const engine = window.engine;
        if (!engine || !engine.canvas || !engine.canvasSize) {
            return false;
        }

        const { x: canvasWidth, y: canvasHeight } = engine.canvasSize;
        const camera = engine.camera;
        const zoom = camera.zoom;

        // Calculate the viewable area in world space
        const worldWidth = canvasWidth / zoom;
        const worldHeight = canvasHeight / zoom;

        // Calculate the top-left corner of the viewable area
        const viewLeft = -camera.position.x / camera.zoom - worldWidth / 2;
        const viewTop = -camera.position.y / camera.zoom - worldHeight / 2;

        // Calculate the nearest tile position to the top-left, outside the viewable area
        // We want to align to grid so that 0,0 falls on the corner between 4 tiles
        const gridLeft = Math.floor(viewLeft / TILE_SIZE) * TILE_SIZE;
        const gridTop = Math.floor(viewTop / TILE_SIZE) * TILE_SIZE;

        // Update entity position
        this.setPosition({ x: gridLeft, y: gridTop });

        // Calculate how many tiles we need to cover the canvas plus a buffer
        const buffer = Math.ceil(GRID_BUFFER / camera.zoom);
        const tilesX = Math.ceil(worldWidth / TILE_SIZE) + buffer;
        const tilesY = Math.ceil(worldHeight / TILE_SIZE) + buffer;

        // Update the repeat parameter
        this.#shapeComponent.repeat = { x: tilesX, y: tilesY };

        return true;
    }
}

export class GridScene extends Scene {
    override create() {
        this.addEntities(new E_Grid());
    }
}
