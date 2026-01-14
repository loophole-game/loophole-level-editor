// Max entity count is 4000
// Max file size is 1 MB

import type { Loophole_ColorPalette } from '../utils';

// Must have an integer value.
export type Loophole_Int = number;

export type Loophole_EdgeAlignment = 'RIGHT' | 'TOP';

// Represents a position in the level.
export type Loophole_Int2 = {
    x: Loophole_Int;
    y: Loophole_Int;
};

// Represents the position of an edge between two tiles.
export type Loophole_EdgePosition = {
    cell: Loophole_Int2;
    alignment: Loophole_EdgeAlignment;
};

// Represents a direction in the level.
// A direction can also represent a rotation, in which case it encodes
// the rotation from "RIGHT" to the direction. For example:
//    - "RIGHT" = 0 deg
//    - "UP"    = 90 deg counter-clockwise
//    - "LEFT"  = 180 deg counter-clockwise
//    - "DOWN"  = 270 deg counter-clockwise
export type Loophole_Rotation = 'RIGHT' | 'UP' | 'LEFT' | 'DOWN';

export type Loophole_WireSprite = 'STRAIGHT' | 'CORNER';

// The color palette for the walls and floors.
//    0: orange floor & blue walls
//    1: blue floor & orange/purple walls
//    2: purple floor & red walls
//    3: pink floor & purple walls
//    4: pale green floor & green walls
//    5: blue floor & green walls
//    6: white floor & red walls
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

export type Loophole_Level = {
    version: 0;
    // The name of the level. Will be displayed in Steam Workshop.
    name: string;
    // The description of the level. Will be displayed in Steam Workshop.
    description: string;
    // The file name for a screenshot that will be displayed in Steam Workshop.
    // This file should be in the same directory as the level when you upload to Workshop.
    imageFile: string;
    // The color palette for the walls and floors.
    //    0: orange floor & blue walls
    //    1: blue floor & orange/purple walls
    //    2: purple floor & red walls
    //    3: pink floor & purple walls
    //    4: pale green floor & green walls
    //    5: blue floor & green walls
    //    6: white floor & red walls
    colorPalette: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    // If true, all the reachable regions in this level will automatically be "discovered".
    // (i.e. These regions will be visible, as if the player had already explored the whole level.)
    // Default value is false.
    automaticallyDiscoverVision: boolean;
    // The configuration of explosions in this level.
    explosions: Loophole_Explosion[];
    // The entity for the time machine that the player will spawn inside.
    entrance: Loophole_TimeMachine;
    // The position where the level exit will be created.
    // This position must not be blocked by any entity.
    exitPosition: Loophole_Int2;
    // A list of all entities in the level, except for the entrance and exit.
    // Only some entities can share the same position. See "Entity Overlap Rules" for more.
    // This array can have at most (MAX_ENTITY_COUNT - 2) elements.
    entities: Loophole_Entity[];
};

export type Loophole_EntityType =
    | 'TIME_MACHINE'
    | 'WALL'
    | 'CURTAIN'
    | 'ONE_WAY'
    | 'GLASS'
    | 'STAFF'
    | 'SAUCE'
    | 'MUSHROOM'
    | 'BUTTON'
    | 'DOOR'
    | 'WIRE'
    | 'CLEANSING_POOL'
    | 'EXIT'
    | 'EXPLOSION';

export type Loophole_Entity =
    | Loophole_TimeMachine
    | Loophole_Wall
    | Loophole_Curtain
    | Loophole_OneWay
    | Loophole_Glass
    | Loophole_Staff
    | Loophole_Sauce
    | Loophole_Mushroom
    | Loophole_Button
    | Loophole_Door
    | Loophole_Wire
    | Loophole_CleansingPool
    | Loophole_Exit
    | Loophole_Explosion;

export type Loophole_ExtendedEntityType =
    | Exclude<Loophole_EntityType, 'MUSHROOM'>
    | 'MUSHROOM_BLUE'
    | 'MUSHROOM_GREEN'
    | 'MUSHROOM_RED';

type Loophole_EntityBase = {
    entityType: Loophole_EntityType;
};

export interface Loophole_Explosion extends Loophole_EntityBase {
    entityType: 'EXPLOSION';
    // The direction that the explosions move
    direction: Loophole_Rotation;
    // The time at which the explosions will reach startPosition
    startTime: Loophole_Int;
    // The position that explosions will reach when time = startTime.
    // If direction is "LEFT" or "RIGHT", this refers to an x coordinate.
    // If direction is "UP" or "DOWN", this refers to a y coordinate.
    startPosition: Loophole_Int;
    // The number of turns it takes for the explosion to move one cell.
    // For example, a value of 0.5 would mean the explosion advances twice every turn.
    period: number;
}

// A time machine, including the walls and doors around it.
export interface Loophole_TimeMachine extends Loophole_EntityBase {
    entityType: 'TIME_MACHINE';
    position: Loophole_Int2;
    // The rotation of the time machine. Aligns with the direction the player will move when going through.
    rotation: Loophole_Rotation;
}

// A barrier that blocks vision and movement.
export interface Loophole_Wall extends Loophole_EntityBase {
    entityType: 'WALL';
    edgePosition: Loophole_EdgePosition;
}

// A barrier that blocks vision, but doesn't block movement.
export interface Loophole_Curtain extends Loophole_EntityBase {
    entityType: 'CURTAIN';
    edgePosition: Loophole_EdgePosition;
}

// A barrier that blocks vision, but only blocks movement in one direction.
export interface Loophole_OneWay extends Loophole_EntityBase {
    entityType: 'ONE_WAY';
    edgePosition: Loophole_EdgePosition;
    // Determines which direction the OneWay faces.
    // If true, the player can move away from edgePosition.cell.
    // If false, the player can move towards edgePosition.cell.
    flipDirection: boolean;
}

// A barrier that blocks movement, but doesn't block vision.
export interface Loophole_Glass extends Loophole_EntityBase {
    entityType: 'GLASS';
    edgePosition: Loophole_EdgePosition;
}

// An item that the player can move to hold down buttons.
export interface Loophole_Staff extends Loophole_EntityBase {
    entityType: 'STAFF';
    position: Loophole_Int2;
}

// A square in which time doesn't advance.
export interface Loophole_Sauce extends Loophole_EntityBase {
    entityType: 'SAUCE';
    position: Loophole_Int2;
}

// An item that gives the player a status effect.
export interface Loophole_Mushroom extends Loophole_EntityBase {
    entityType: 'MUSHROOM';
    position: Loophole_Int2;
    mushroomType: 'BLUE' | 'GREEN' | 'RED';
}

// A square that removes status effects from the player.
export interface Loophole_CleansingPool extends Loophole_EntityBase {
    entityType: 'CLEANSING_POOL';
    position: Loophole_Int2;
}

// An entity that activates a channel when overlapping with a Player or a Staff.
export interface Loophole_Button extends Loophole_EntityBase {
    entityType: 'BUTTON';
    position: Loophole_Int2;
    // When this Button is activated, Doors and Wires that share this channel will become activated.
    channel: Loophole_Int;
}

// A barrier the blocks the movement unless a channel is activated.
export interface Loophole_Door extends Loophole_EntityBase {
    entityType: 'DOOR';
    edgePosition: Loophole_EdgePosition;
    // The door opens when this channel is activated.
    channel: Loophole_Int;
}

// A decoration that can indicate connections between buttons and doors.
//
//          | Right |  Up   | Left  | Down
// ---------+-------+-------+-------+-------
// Straight |   -   |   |   |   -   |   |
// ---------+-------+-------+-------+-------
// Corner   |   ┘   |   ┐   |   ┌   |   └
//
export interface Loophole_Wire extends Loophole_EntityBase {
    entityType: 'WIRE';
    position: Loophole_Int2;
    rotation: Loophole_Rotation;
    sprite: Loophole_WireSprite;
    // The wire lights up when this channel is activated.
    channel: Loophole_Int;
}

export interface Loophole_Exit extends Loophole_EntityBase {
    entityType: 'EXIT';
    position: Loophole_Int2;
}

export interface WithID {
    tID: string;
}

export type Loophole_EntityWithID = Loophole_Entity & WithID;

export type Loophole_InternalLevel = Omit<
    Loophole_Level,
    'entities' | 'explosions' | 'colorPalette'
> & {
    entities: Loophole_EntityWithID[];
    entrance: Loophole_Level['entrance'] & WithID;
    explosions: (Loophole_Explosion & WithID)[];
    id: string;
    colorPalette: Loophole_ColorPalette;
    updatedAt: number;
};

/* =============== Constraints =============== */

// The maximum number of entities allowed in a level.
// This includes the entrance and exit, so the entities array
// has a maximum length of  MAX_ENTITY_COUNT - 2.
export const MAX_ENTITY_COUNT: Loophole_Int = 4000;

// The maximum file size, in bytes (1MB).
export const MAX_FILE_SIZE: Loophole_Int = 1_048_576;

// The maximum position (inclusive) for all entities, the entrance, and the exit.
export const MAX_POSITION: Loophole_Int2 = { x: 192, y: 104 };

// The minimum position (inclusive) for all entities, the entrance, and the exit.
export const MIN_POSITION: Loophole_Int2 = { x: -192, y: -104 };

//
// Entity Overlap Rules
//
//              | TimeMachine | Staff | Sauce | Mushroom | Button | Wire  | Exit
// -------------+-------------+-------+-------+----------+--------+-------+-------
//  TimeMachine |      N      |   N   |   N   |    N     |    N   |   N   |   N
//  Staff       |      -      |   N   |   Y   |    Y     |    Y   |   Y   |   N
//  Sauce       |      -      |   -   |   N   |    Y     |    Y   |   Y   |   N
//  Mushroom    |      -      |   -   |   -   |    N     |    Y   |   Y   |   N
//  Button      |      -      |   -   |   -   |    -     |    N   |   Y   |   N
//  Wire        |      -      |   -   |   -   |    -     |    -   |   N   |   Y
//  Exit        |      -      |   -   |   -   |    -     |    -   |   -   |   N
//
//              | Wall | Curtain | OneWay | Glass | Door
// -------------+------+---------+--------+-------+------
//  Wall        |   N  |    N    |    N   |   N   |   N
//  Curtain     |   -  |    N    |    N   |   N   |   Y
//  OneWay      |   -  |    -    |    N   |   N   |   Y
//  Glass       |   -  |    -    |    -   |   N   |   N
//  Door        |   -  |    -    |    -   |   -   |   N
//
