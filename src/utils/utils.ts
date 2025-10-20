import { v4 } from 'uuid';
import type {
    Loophole_Button,
    Loophole_Curtain,
    Loophole_Door,
    Loophole_Entity,
    Loophole_ExtendedEntityType,
    Loophole_Glass,
    Loophole_Int2,
    Loophole_Level,
    Loophole_Mushroom,
    Loophole_OneWay,
    Loophole_Sauce,
    Loophole_Staff,
    Loophole_TimeMachine,
    Loophole_Wall,
    Loophole_Wire,
} from './editor/externalLevelSchema';

export const TILE_EDGE_HEIGHT_FRACTION = 0.3;
export const TILE_EDGE_WIDTH_FRACTION = 1;
export const TILE_CENTER_FRACTION = 0.7;
export const TILE_SIZE = 100;

export const MAX_ENTITY_COUNT = 4000;

export type LoopholeEntityPositionType = 'CELL' | 'EDGE';

export const getLoopholeEntityPositionType = (
    entity: Loophole_Entity,
): LoopholeEntityPositionType => {
    if (
        entity.entityType === 'WALL' ||
        entity.entityType === 'CURTAIN' ||
        entity.entityType === 'ONE_WAY' ||
        entity.entityType === 'GLASS' ||
        entity.entityType === 'DOOR'
    ) {
        return 'EDGE';
    } else {
        return 'CELL';
    }
};

export const getLoopholeEntityPosition = (entity: Loophole_Entity): Loophole_Int2 => {
    if (
        entity.entityType === 'WALL' ||
        entity.entityType === 'CURTAIN' ||
        entity.entityType === 'ONE_WAY' ||
        entity.entityType === 'GLASS' ||
        entity.entityType === 'DOOR'
    ) {
        return entity.edgePosition.cell;
    } else {
        return entity.position;
    }
};

export const ColorPalette = {
    ORANGE: 0,
    BLUE: 1,
    PURPLE: 2,
    PINK: 3,
    PALE_GREEN: 4,
    GREEN: 5,
    WHITE: 6,
};
export type ColorPalette = (typeof ColorPalette)[keyof typeof ColorPalette];

export type LevelWithMetadata = {
    id: string;
    level: Loophole_Level;
    name: string;
    createdAt: number;
    updatedAt: number;
};

export const getTimestamp = (): number => Date.now();

interface EntityMetadata {
    name: string;
    description: string;
    src: string;
    createEntity: (position: Loophole_Int2) => Loophole_Entity;
}

export const ENTITY_METADATA: Record<Loophole_ExtendedEntityType, EntityMetadata> = {
    TIME_MACHINE: {
        name: 'Time Machine',
        description: 'A time machine that the player will spawn inside.',
        src: 'pixel/time-machine.png',
        createEntity: (position: Loophole_Int2): Loophole_TimeMachine => ({
            entityType: 'TIME_MACHINE',
            position,
            rotation: 'RIGHT',
        }),
    },
    WALL: {
        name: 'Wall',
        description: 'A wall that blocks vision and movement.',
        src: 'pixel/wall.png',
        createEntity: (position: Loophole_Int2): Loophole_Wall => ({
            entityType: 'WALL',
            edgePosition: { cell: position, alignment: 'RIGHT' },
        }),
    },
    CURTAIN: {
        name: 'Curtain',
        description: 'A curtain that blocks vision and movement.',
        src: 'pixel/curtain.png',
        createEntity: (position: Loophole_Int2): Loophole_Curtain => ({
            entityType: 'CURTAIN',
            edgePosition: { cell: position, alignment: 'RIGHT' },
        }),
    },
    ONE_WAY: {
        name: 'One Way',
        description: 'A one way that allows movement in one direction.',
        src: 'pixel/one-way.png',
        createEntity: (position: Loophole_Int2): Loophole_OneWay => ({
            entityType: 'ONE_WAY',
            edgePosition: { cell: position, alignment: 'RIGHT' },
            flipDirection: false,
        }),
    },
    GLASS: {
        name: 'Glass',
        description: 'A glass that blocks vision and movement.',
        src: 'pixel/glass.png',
        createEntity: (position: Loophole_Int2): Loophole_Glass => ({
            entityType: 'GLASS',
            edgePosition: { cell: position, alignment: 'RIGHT' },
        }),
    },
    STAFF: {
        name: 'Staff',
        description: 'A staff that allows movement in one direction.',
        src: 'pixel/box.png',
        createEntity: (position: Loophole_Int2): Loophole_Staff => ({
            entityType: 'STAFF',
            position,
        }),
    },
    SAUCE: {
        name: 'Sauce',
        description: 'A sauce that allows movement in one direction.',
        src: 'pixel/sauce.png',
        createEntity: (position: Loophole_Int2): Loophole_Sauce => ({
            entityType: 'SAUCE',
            position,
        }),
    },
    BUTTON: {
        name: 'Button',
        description: 'A button that allows movement in one direction.',
        src: 'pixel/button.png',
        createEntity: (position: Loophole_Int2): Loophole_Button => ({
            entityType: 'BUTTON',
            position,
            channel: 0,
        }),
    },
    DOOR: {
        name: 'Door',
        description: 'A door that allows movement in one direction.',
        src: 'pixel/door.png',
        createEntity: (position: Loophole_Int2): Loophole_Door => ({
            entityType: 'DOOR',
            edgePosition: { cell: position, alignment: 'RIGHT' },
            channel: 0,
        }),
    },
    WIRE: {
        name: 'Wire',
        description: 'A wire that allows movement in one direction.',
        src: 'pixel/wire.png',
        createEntity: (position: Loophole_Int2): Loophole_Wire => ({
            entityType: 'WIRE',
            position,
            sprite: 'STRAIGHT',
            channel: 0,
            rotation: 'RIGHT',
        }),
    },
    MUSHROOM_BLUE: {
        name: 'Invisibility Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/invis.png',
        createEntity: (position: Loophole_Int2): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'BLUE',
        }),
    },
    MUSHROOM_GREEN: {
        name: 'Drugs Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/drugs.png',
        createEntity: (position: Loophole_Int2): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'GREEN',
        }),
    },
    MUSHROOM_RED: {
        name: 'Shield Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/shield.png',
        createEntity: (position: Loophole_Int2): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'RED',
        }),
    },
};

export const createLevelWithMetadata = (name: string): LevelWithMetadata => ({
    id: v4(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    level: {
        colorPalette: 0,
        entities: [],
        entrance: {
            entityType: 'TIME_MACHINE',
            position: { x: 0, y: 0 },
            rotation: 'RIGHT',
        },
        exitPosition: { x: 0, y: 0 },
        version: 0,
    },
});
