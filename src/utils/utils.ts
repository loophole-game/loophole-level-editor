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
    Loophole_Mushroom,
    Loophole_OneWay,
    Loophole_Sauce,
    Loophole_Staff,
    Loophole_TimeMachine,
    Loophole_Wall,
    Loophole_Wire,
    Loophole_CleansingPool,
    Loophole_InternalLevel,
    Loophole_Exit,
    Loophole_WireSprite,
    Loophole_Explosion,
    Loophole_Int,
    Loophole_Level,
} from './levelEditor/externalLevelSchema';
import type { BoundingBox, CameraData } from './engine/types';
import { Vector, type IVector } from './engine/math';
import type { E_Tile } from './levelEditor/scenes/grid';
import { calculatePositionsBoundingBox, scaleToZoom } from './engine/utils';

export const TILE_CENTER_FRACTION = 1;
export const TILE_SIZE = 100;

export type LoopholePositionType = 'CELL' | 'EDGE';

const ENTITY_TYPE_DRAW_ORDER_LIST: Loophole_EntityType[] = [
    'WIRE',
    'CLEANSING_POOL',
    'BUTTON',
    'MUSHROOM',
    'STAFF',
    'WALL',
    'GLASS',
    'DOOR',
    'CURTAIN',
    'ONE_WAY',
    'SAUCE',
    'TIME_MACHINE',
    'EXPLOSION',
    'EXIT',
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

    if ('position' in entity) {
        return entity.position;
    }

    return getLoopholeExplosionPosition(entity);
};

export const loopholePositionToEnginePosition = (
    position: Loophole_Int2,
    edgeAlignment?: Loophole_EdgeAlignment | null,
): Vector => {
    return new Vector(
        position.x + (edgeAlignment === 'RIGHT' ? 0.5 : 0),
        -(position.y + (edgeAlignment === 'TOP' ? 0.5 : 0)),
    );
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

export const getTimestamp = (): number => Date.now();

const DEFAULT_EDGE_ALIGNMENT: Loophole_EdgeAlignment = 'RIGHT';
const DEFAULT_WALL_SCALE = 1;

export const OVERLAPPABLE_ENTITY_TYPES: Loophole_EntityType[][] = [
    ['CURTAIN', 'DOOR'],
    ['EXPLOSION', 'TIME_MACHINE'],
];

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
    tileScale?: number;
    highlightScale?: number;
    hasRotation?: boolean;
    hasDirection?: boolean;
    hasFlipDirection?: boolean;
    hasChannel?: boolean;
    hasWireSprite?: boolean;
    hideInPicker?: boolean;
    dragPlacementDisabled?: boolean;
}

export const ENTITY_METADATA: Record<Loophole_ExtendedEntityType, EntityMetadata> = {
    TIME_MACHINE: {
        name: 'Time Machine',
        description: 'A time machine that the player will spawn inside.',
        src: 'vector/time-machine.svg',
        type: 'TIME_MACHINE',
        extendedType: 'TIME_MACHINE',
        positionType: 'CELL',
        createEntity: (position, _, rotation): Loophole_TimeMachine => ({
            entityType: 'TIME_MACHINE',
            position,
            rotation,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        hasRotation: true,
        dragPlacementDisabled: true,
        highlightScale: 1.3,
    },
    WALL: {
        name: 'Wall',
        description: 'A wall that blocks vision and movement.',
        src: 'vector/wall.svg',
        type: 'WALL',
        extendedType: 'WALL',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Wall => ({
            entityType: 'WALL',
            edgePosition: {
                cell: position,
                alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT,
            },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
    },
    CURTAIN: {
        name: 'Curtain',
        description: 'A curtain that blocks vision and movement.',
        src: 'vector/curtain.svg',
        type: 'CURTAIN',
        extendedType: 'CURTAIN',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Curtain => ({
            entityType: 'CURTAIN',
            edgePosition: {
                cell: position,
                alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT,
            },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: 1.1,
    },
    ONE_WAY: {
        name: 'One-Way',
        description: 'A one-way that allows movement in one direction.',
        src: 'vector/one-way.svg',
        type: 'ONE_WAY',
        extendedType: 'ONE_WAY',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment, _, flipDirection): Loophole_OneWay => ({
            entityType: 'ONE_WAY',
            edgePosition: {
                cell: position,
                alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT,
            },
            flipDirection,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
        hasFlipDirection: true,
    },
    GLASS: {
        name: 'Glass',
        description: 'A glass that blocks vision and movement.',
        src: 'vector/glass.svg',
        type: 'GLASS',
        extendedType: 'GLASS',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Glass => ({
            entityType: 'GLASS',
            edgePosition: {
                cell: position,
                alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT,
            },
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        tileScale: DEFAULT_WALL_SCALE,
    },
    STAFF: {
        name: 'Staff',
        description: 'A staff that allows movement in one direction.',
        src: 'vector/staff.svg',
        type: 'STAFF',
        extendedType: 'STAFF',
        positionType: 'CELL',
        createEntity: (position): Loophole_Staff => ({
            entityType: 'STAFF',
            position,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
    },
    BUTTON: {
        name: 'Button',
        description: 'A button that allows movement in one direction.',
        src: 'vector/button.svg',
        type: 'BUTTON',
        extendedType: 'BUTTON',
        positionType: 'CELL',
        createEntity: (position): Loophole_Button => ({
            entityType: 'BUTTON',
            position,
            channel: 0,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
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
        highlightScale: 1,
        tileScale: 1.002,
    },
    DOOR: {
        name: 'Door',
        description: 'A door that allows movement in one direction.',
        src: 'vector/door.svg',
        type: 'DOOR',
        extendedType: 'DOOR',
        positionType: 'EDGE',
        createEntity: (position, edgeAlignment): Loophole_Door => ({
            entityType: 'DOOR',
            edgePosition: {
                cell: position,
                alignment: edgeAlignment || DEFAULT_EDGE_ALIGNMENT,
            },
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
        hasWireSprite: true,
    },
    CLEANSING_POOL: {
        name: 'Cleansing Pool',
        description: 'A pool that cleanses the player of all status effects.',
        src: 'vector/pool.svg',
        type: 'CLEANSING_POOL',
        extendedType: 'CLEANSING_POOL',
        positionType: 'CELL',
        createEntity: (position): Loophole_CleansingPool => ({
            entityType: 'CLEANSING_POOL',
            position,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
    },
    MUSHROOM_BLUE: {
        name: 'Invisibility Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'vector/blue-mushroom.svg',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_BLUE',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'BLUE',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
    },
    MUSHROOM_GREEN: {
        name: 'Drugs Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'vector/green-mushroom.svg',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_GREEN',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'GREEN',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
    },
    MUSHROOM_RED: {
        name: 'Shield Pickup',
        description: 'A mushroom that allows movement in one direction.',
        src: 'vector/red-mushroom.svg',
        type: 'MUSHROOM',
        extendedType: 'MUSHROOM_RED',
        positionType: 'CELL',
        createEntity: (position): Loophole_Mushroom => ({
            entityType: 'MUSHROOM',
            position,
            mushroomType: 'RED',
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
    },
    EXIT: {
        name: 'Exit',
        description: "The level's exit.",
        src: 'vector/exit.svg',
        type: 'EXIT',
        extendedType: 'EXIT',
        positionType: 'CELL',
        createEntity: (position): Loophole_Exit => ({
            entityType: 'EXIT',
            position,
        }),
        tileOwnership: 'ONLY_ENTITY_IN_TILE',
        hideInPicker: true,
    },
    EXPLOSION: {
        name: 'Explosion',
        description: 'An explosion that damages the player.',
        src: 'vector/explosion.svg',
        type: 'EXPLOSION',
        extendedType: 'EXPLOSION',
        positionType: 'CELL',
        createEntity: (position, _, rotation): Loophole_Explosion => ({
            entityType: 'EXPLOSION',
            startPosition: rotation === 'RIGHT' || rotation === 'LEFT' ? position.x : position.y,
            direction: rotation,
            startTime: 0,
            period: 0.5,
        }),
        tileOwnership: 'ONLY_TYPE_IN_TILE',
        dragPlacementDisabled: true,
        hasDirection: true,
    },
};

export const createLevelWithMetadata = (name: string, id?: string): Loophole_InternalLevel => ({
    colorPalette: 0,
    entities: [],
    entrance: {
        entityType: 'TIME_MACHINE',
        position: { x: -1, y: 0 },
        rotation: 'RIGHT',
        tID: v4(),
    },
    exitPosition: { x: 1, y: 0 },
    version: 0,
    name,
    description: '',
    id: id ?? v4(),
    explosions: [],
    imageFile: '',
    updatedAt: Date.now(),
});

export const exportLoopholeInternalLevel = ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    entrance: { tID, ...entranceRest },
    entities,
    ...rest
}: Loophole_InternalLevel): Loophole_Level => ({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    entities: entities.map(({ tID, ...rest }) => rest),
    entrance: entranceRest,
});

export const loopholeRotationToDegrees = (rotation: Loophole_Rotation): number => {
    switch (rotation) {
        case 'UP':
            return 270;
        case 'LEFT':
            return 180;
        case 'DOWN':
            return 90;
        case 'RIGHT':
        default:
            return 0;
    }
};

const LOOPHOLE_ROTATION_LIST: Loophole_Rotation[] = ['RIGHT', 'DOWN', 'LEFT', 'UP'];

export const degreesToLoopholeRotation = (rotation: number): Loophole_Rotation => {
    return LOOPHOLE_ROTATION_LIST[Math.round(((rotation + 360) % 360) / 90)];
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

export const getLoopholeEntityDirection = (entity: Loophole_Entity): Loophole_Rotation | null => {
    if ('direction' in entity) {
        return entity.direction;
    }

    return null;
};

export const getLoopholeExplosionPeriod = (entity: Loophole_Entity): number => {
    if ('period' in entity) {
        return entity.period;
    }

    return 1;
};

export const getLoopholeEntityFlipDirection = (entity: Loophole_Entity): boolean => {
    if ('flipDirection' in entity) {
        return entity.flipDirection;
    }

    return false;
};

export const getLoopholeEntityChannel = (entity: Loophole_Entity): number | null => {
    if ('channel' in entity) {
        return entity.channel;
    }

    return null;
};

export const getLoopholeWireSprite = (entity: Loophole_Entity): Loophole_WireSprite | null => {
    if ('sprite' in entity) {
        return entity.sprite;
    }

    return null;
};

export const getLoopholeExplosionPosition = (
    explosion: Loophole_Explosion,
    offset?: Loophole_Int2,
): Loophole_Int2 => {
    return explosion.direction === 'RIGHT' || explosion.direction === 'LEFT'
        ? {
              x: explosion.startPosition + (offset?.x ?? 0),
              y: 0,
          }
        : {
              x: 0,
              y: explosion.startPosition + (offset?.y ?? 0),
          };
};

export const getLoopholeExplosionStartPosition = (
    explosion: Loophole_Explosion,
    position: Loophole_Int2,
): Loophole_Int => {
    return explosion.direction === 'RIGHT' || explosion.direction === 'LEFT'
        ? position.x
        : position.y;
};

export const calculateSelectionCenter = (tiles: E_Tile[]): Vector => {
    const box = calculatePositionsBoundingBox(
        tiles.map((t) =>
            t.entity.entityType === 'EXPLOSION' ? t.highlightEntity.position : t.position,
        ),
    );

    return new Vector((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2);
};

export const WIRE_CORNER_SPRITE = 'WireCorner';
export const GUY_SPRITE = 'Guy';

export const formatToSnakeCase = (str: string): string => {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .replace(/[^\w_]/g, '')
        .toLowerCase();
};

export const Loophole_ColorPalette = {
    ONE: 0,
    TWO: 1,
    THREE: 2,
    FOUR: 3,
    FIVE: 4,
    SIX: 5,
    SEVEN: 6,
} as const;
export type Loophole_ColorPalette =
    (typeof Loophole_ColorPalette)[keyof typeof Loophole_ColorPalette];

export const COLOR_PALETTE_METADATA: Record<
    Loophole_ColorPalette,
    {
        name: string;
        class: string;
        image: string;
        wallImage: string;
    }
> = {
    [Loophole_ColorPalette.ONE]: {
        name: 'One',
        class: 'color-palette-one',
        image: 'color-screenshots/1.png',
        wallImage: 'vector/wall-1.svg',
    },
    [Loophole_ColorPalette.TWO]: {
        name: 'Two',
        class: 'color-palette-two',
        image: 'color-screenshots/2.png',
        wallImage: 'vector/wall-2.svg',
    },
    [Loophole_ColorPalette.THREE]: {
        name: 'Three',
        class: 'color-palette-three',
        image: 'color-screenshots/3.png',
        wallImage: 'vector/wall-3.svg',
    },
    [Loophole_ColorPalette.FOUR]: {
        name: 'Four',
        class: 'color-palette-four',
        image: 'color-screenshots/4.png',
        wallImage: 'vector/wall-4.svg',
    },
    [Loophole_ColorPalette.FIVE]: {
        name: 'Five',
        class: 'color-palette-five',
        image: 'color-screenshots/5.png',
        wallImage: 'vector/wall-5.svg',
    },
    [Loophole_ColorPalette.SIX]: {
        name: 'Six',
        class: 'color-palette-six',
        image: 'color-screenshots/6.png',
        wallImage: 'vector/wall-6.svg',
    },
    [Loophole_ColorPalette.SEVEN]: {
        name: 'Seven',
        class: 'color-palette-seven',
        image: 'color-screenshots/7.png',
        wallImage: 'vector/wall-7.svg',
    },
};

export const DEFAULT_LEVEL_NAME = 'Untitled Level';

const LEVEL_CAMERA_PADDING = 4;

export const calculateLevelBoundingBox = (
    level: Loophole_InternalLevel,
    worldScale = false,
): BoundingBox => {
    const entityPositions: IVector<number>[] = [
        ...[...level.entities, ...level.explosions, level.entrance].map((e) =>
            loopholePositionToEnginePosition(getLoopholeEntityPosition(e)),
        ),
        level.exitPosition,
    ];

    const box = calculatePositionsBoundingBox(entityPositions);
    if (worldScale) {
        box.x1 *= TILE_SIZE;
        box.x2 *= TILE_SIZE;
        box.y1 *= TILE_SIZE;
        box.y2 *= TILE_SIZE;
    }

    return box;
};

export const calculateLevelCameraTarget = (level: Loophole_InternalLevel): CameraData => {
    const boundingBox = calculateLevelBoundingBox(level);
    boundingBox.x1 -= LEVEL_CAMERA_PADDING;
    boundingBox.x2 += LEVEL_CAMERA_PADDING;
    boundingBox.y1 -= LEVEL_CAMERA_PADDING;
    boundingBox.y2 += LEVEL_CAMERA_PADDING;
    boundingBox.x1 *= TILE_SIZE;
    boundingBox.x2 *= TILE_SIZE;
    boundingBox.y1 *= TILE_SIZE;
    boundingBox.y2 *= TILE_SIZE;

    const boundingSize = new Vector(
        boundingBox.x2 - boundingBox.x1,
        boundingBox.y2 - boundingBox.y1,
    );
    const screenSize = new Vector(window.innerWidth, window.innerHeight);

    const targetPosition = new Vector(
        -(boundingBox.x1 + boundingBox.x2) / 2,
        -(boundingBox.y1 + boundingBox.y2) / 2,
    );

    const scaleX = screenSize.x / boundingSize.x;
    const scaleY = screenSize.y / boundingSize.y;
    const targetScale = Math.min(scaleX, scaleY);
    const targetZoom = scaleToZoom(targetScale);

    return {
        position: { x: targetPosition.x * targetScale, y: targetPosition.y * targetScale },
        rotation: 0,
        zoom: targetZoom,
    };
};
