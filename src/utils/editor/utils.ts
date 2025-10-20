import type { Loophole_Entity, Loophole_Int2 } from './externalLevelSchema';

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
