import { v4 } from 'uuid';
import type {
    Loophole_Button,
    Loophole_Curtain,
    Loophole_Rotation,
    Loophole_Door,
    Loophole_EdgeAlignment,
    Loophole_Entity,
    Loophole_EntityType,
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
    Loophole_CleansingPool,
} from './levelEditor/externalLevelSchema';
import type { Position } from './engine/types';

export const TILE_CENTER_FRACTION = 0.7;
export const TILE_SIZE = 100;

export const MAX_ENTITY_COUNT = 4000;

export type LoopholePositionType = 'CELL' | 'EDGE';

const ENTITY_TYPE_DRAW_ORDER_LIST: Loophole_EntityType[] = [
    'WIRE',
    'CLEANSING_POOL',
    'BUTTON',
    'MUSHROOM',
    'STAFF',
    'WALL',
    'ONE_WAY',
    'GLASS',
    'DOOR',
    'CURTAIN',
    'TIME_MACHINE',
    'SAUCE',
] as const;
export const ENTITY_TYPE_DRAW_ORDER: Record<Loophole_EntityType, number> =
    ENTITY_TYPE_DRAW_ORDER_LIST.reduce(
        (acc, type, index) => {
            acc[type] = index;
            return acc;
        },
        {} as Record<Loophole_EntityType, number>,
    );

export const getLoopholeEntityExtendedType = (
    entity: Loophole_Entity,
): Loophole_ExtendedEntityType => {
    switch (entity.entityType) {
        case 'MUSHROOM':
            switch (entity.mushroomType) {
                case 'BLUE':
                    return 'MUSHROOM_BLUE';
                case 'GREEN':
                    return 'MUSHROOM_GREEN';
                case 'RED':
                    return 'MUSHROOM_RED';
            }
            break;
        default:
            return entity.entityType as Loophole_ExtendedEntityType;
    }
};

export const convertLoopholeTypeToExtendedType = (
    type: Loophole_EntityType,
): Loophole_ExtendedEntityType => {
    switch (type) {
        case 'MUSHROOM':
            return 'MUSHROOM_RED';
        default:
            return type as Loophole_ExtendedEntityType;
    }
};

export const getLoopholeEntityPositionType = (entity: Loophole_Entity): LoopholePositionType => {
    if ('edgePosition' in entity) {
        return 'EDGE';
    }

    return 'CELL';
};

export const getLoopholeEntityPosition = (entity: Loophole_Entity): Loophole_Int2 => {
    if ('edgePosition' in entity) {
        return entity.edgePosition.cell;
    }

    return entity.position;
};

export const loopholePositionToEnginePosition = (
    position: Loophole_Int2,
    edgeAlignment?: Loophole_EdgeAlignment | null,
): Position => {
    return {
        x: position.x + (edgeAlignment === 'RIGHT' ? 0.5 : 0),
        y: position.y + (edgeAlignment === 'TOP' ? 0.5 : 0),
    };
};

export const getLoopholeEntityEdgeAlignment = (
    entity: Loophole_Entity,
): Loophole_EdgeAlignment | null => {
    if ('edgePosition' in entity) {
        return entity.edgePosition.alignment;
    }

    return null;
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

const DEFAULT_EDGE_ALIGNMENT: Loophole_EdgeAlignment = 'RIGHT';
const DEFAULT_WALL_SCALE = 0.85;

export const OVERLAPPABLE_ENTITY_TYPES: Loophole_EntityType[][] = [['CURTAIN', 'DOOR']];

type TileOwnership = 'ONLY_ENTITY_IN_TILE' | 'ONLY_TYPE_IN_TILE';

interface EntityMetadata {
    name: string;
    description: string;
    src: string;
    type: Loophole_EntityType;
    extendedType: Loophole_ExtendedEntityType;
    positionType: LoopholePositionType;
    createEntity: (
        position: Loophole_Int2,
        edgeAlignment: Loophole_EdgeAlignment | null,
        rotation: Loophole_Rotation,
        flipDirection: boolean,
    ) => Loophole_Entity;
    tileOwnership: TileOwnership;
    tileScale: number;
    hasRotation?: boolean;
    hasFlipDirection?: boolean;
    hasChannel?: boolean;
}

export const ENTITY_METADATA: Record<Loophole_ExtendedEntityType, EntityMetadata> = {
    TIME_MACHINE: {
        name: 'Time Machine',
        description: 'A time machine that the player will spawn inside.',
        src: 'pixel/time-machine.png',
        type: 'TIME_MACHINE',
        extendedType: 'TIME_MACHINE',
        positionType: 'CELL',
        createEntity: (position, _, rotation): Loophole_TimeMachine => ({
            entityType: 'TIME_MACHINE',
            position,
            rotation,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
        hasRotation: true,
    },
    WALL: {
        name: 'Wall',
        description: 'A wall that blocks vision and movement.',
        src: 'pixel/wall.png',
        type: 'WALL',
        extendedType: 'WALL',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Wall => ({
            entityType: 'WALL',
            edgePosition: { cell: position, alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
    },
    CURTAIN: {
        name: 'Curtain',
        description: 'A curtain that blocks vision and movement.',
        src: 'pixel/curtain.png',
        type: 'CURTAIN',
        extendedType: 'CURTAIN',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Curtain => ({
            entityType: 'CURTAIN',
            edgePosition: { cell: position, alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
    },
    ONE_WAY: {
        name: 'One-Way',
        description: 'A one-way that allows movement in one direction.',
        src: 'pixel/one-way.png',
        type: 'ONE_WAY',
        extendedType: 'ONE_WAY',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment, _, flipDirection): Loophole_OneWay => ({
            entityType: 'ONE_WAY',
            edgePosition: { cell: position, alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT },
            flipDirection,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
        hasFlipDirection: true,
    },
    GLASS: {
        name: 'Glass',
        description: 'A glass that blocks vision and movement.',
        src: 'pixel/glass.png',
        type: 'GLASS',
        extendedType: 'GLASS',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Glass => ({
            entityType: 'GLASS',
            edgePosition: { cell: position, alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
    },
    STAFF: {
        name: 'Staff',
        description: 'A staff that allows movement in one direction.',
        src: 'pixel/box.png',
        type: 'STAFF',
        extendedType: 'STAFF',
        positionType: 'CELL',
        createEntity: (position): Loophole_Staff => ({
            entityType: 'STAFF',
            position,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
    },
    BUTTON: {
        name: 'Button',
        description: 'A button that allows movement in one direction.',
        src: 'pixel/button.png',
        type: 'BUTTON',
        extendedType: 'BUTTON',
        positionType: 'CELL',
        createEntity: (position): Loophole_Button => ({
            entityType: 'BUTTON',
            position,
            channel: 0,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
        hasChannel: true,
    },
    SAUCE: {
        name: 'Sauce',
        description: 'A sauce that allows movement in one direction.',
        src: 'pixel/sauce.png',
        type: 'SAUCE',
        extendedType: 'SAUCE',
        positionType: 'CELL',
        createEntity: (position): Loophole_Sauce => ({
            entityType: 'SAUCE',
            position,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: 1.001,
    },
    DOOR: {
        name: 'Door',
        description: 'A door that allows movement in one direction.',
        src: 'pixel/door.png',
        type: 'DOOR',
        extendedType: 'DOOR',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Door => ({
            entityType: 'DOOR',
            edgePosition: { cell: position, alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT },
            channel: 0,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
        hasChannel: true,
    },
    WIRE: {
        name: 'Wire',
        description: 'A wire that allows movement in one direction.',
        src: 'pixel/wire.png',
        type: 'WIRE',
        extendedType: 'WIRE',
        positionType: 'CELL',
        createEntity: (position, _, rotation): Loophole_Wire => ({
            entityType: 'WIRE',
            position,
            sprite: 'STRAIGHT',
            channel: 0,
            rotation,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: 1,
        hasRotation: true,
        hasChannel: true,
    },
    CLEANSING_POOL: {
        name: 'Cleansing Pool',
        description: 'A pool that cleanses the player of all status effects.',
        src: 'pixel/pool.png',
        type: 'CLEANSING_POOL',
        extendedType: 'CLEANSING_POOL',
        positionType: 'CELL',
        createEntity: (position): Loophole_CleansingPool => ({
            entityType: 'CLEANSING_POOL',
            position,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
    },
    MUSHROOM_BLUE: {
        name: 'Invisibility Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/invis.png',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_BLUE',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'BLUE',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
    },
    MUSHROOM_GREEN: {
        name: 'Drugs Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/drugs.png',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_GREEN',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'GREEN',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
    },
    MUSHROOM_RED: {
        name: 'Shield Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'pixel/shield.png',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_RED',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'RED',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        tileScale: TILE_CENTER_FRACTION,
    },
};

export const createLevelWithMetadata = (name: string, id?: string): LevelWithMetadata => ({
    id: id ?? v4(),
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

export const loopholeRotationToDegrees = (rotation: Loophole_Rotation): number => {
    switch (rotation) {
        case 'UP':
            return 90;
        case 'LEFT':
            return 180;
        case 'DOWN':
            return 270;
        case 'RIGHT':
        default:
            return 0;
    }
};

const LOOPHOLE_ROTATION_LIST: Loophole_Rotation[] = ['RIGHT', 'UP', 'LEFT', 'DOWN'];

export const degreesToLoopholeRotation = (rotation: number): Loophole_Rotation => {
    return LOOPHOLE_ROTATION_LIST[Math.round((rotation % 360) / 90)];
};

export const getLoopholeEntityDegreeRotation = (entity: Loophole_Entity): number => {
    if ('edgePosition' in entity) {
        return (
            loopholeRotationToDegrees(entity.edgePosition.alignment === 'RIGHT' ? 'RIGHT' : 'UP') +
            ('flipDirection' in entity && entity.flipDirection ? 180 : 0)
        );
    }
    if ('rotation' in entity) {
        return loopholeRotationToDegrees(entity.rotation);
    }

    return 0;
};

export const getLoopholeEntityChannel = (entity: Loophole_Entity): number | null => {
    if ('channel' in entity) {
        return entity.channel;
    }

    return null;
};
