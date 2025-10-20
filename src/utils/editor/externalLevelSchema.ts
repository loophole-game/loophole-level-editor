// Max entity count is 4000
// Max file size is 1 MB

// Must have an integer value.
export type Loophole_Int = number;

// Represents a position in the level.
export type Loophole_Int2 = {
    x: Loophole_Int;
    y: Loophole_Int;
};

// Represents the position of an edge between two tiles.
export type Loophole_EdgePosition = {
    cell: Loophole_Int2;
    alignment: 'RIGHT' | 'TOP';
};

// Represents a direction in the level.
// A direction can also represent a rotation, in which case it encodes
// the rotation from "RIGHT" to the direction. For example:
//    - "RIGHT" = 0 deg
//    - "UP"    = 90 deg counter-clockwise
//    - "LEFT"  = 180 deg counter-clockwise
//    - "DOWN"  = 270 deg counter-clockwise
export type Loophole_Direction = 'RIGHT' | 'UP' | 'LEFT' | 'DOWN';

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
    colorPalette: ColorPalette;
    // The entity for the time machine that the player will spawn inside.
    entrance: Loophole_TimeMachine;
    // The position where the level exit will be created.
    // This position must not be blocked by any entity.
    exitPosition: Loophole_Int2;
    // A list of all entities in the level, except for the entrance and exit.
    // Only some entities can share the same position. See "Entity Overlap Rules" for more.
    // This array can have at most (MAX_ENTITY_COUNT - 2) elements
    entities: Loophole_Entity[];
};

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
    | Loophole_Wire;
export type Loophole_EntityType = Loophole_Entity['entityType'];

export type Loophole_ExtendedEntityType =
    | Exclude<Loophole_EntityType, 'MUSHROOM'>
    | 'MUSHROOM_BLUE'
    | 'MUSHROOM_GREEN'
    | 'MUSHROOM_RED';

// A time machine, including the walls and doors around it.
export type Loophole_TimeMachine = {
    entityType: 'TIME_MACHINE';
    position: Loophole_Int2;
    // The rotation of the time machine. Aligns with the direction the player will move when going through.
    rotation: Loophole_Direction;
};

// A barrier that blocks vision and movement.
export type Loophole_Wall = {
    entityType: 'WALL';
    edgePosition: Loophole_EdgePosition;
};

// A barrier that blocks vision, but doesn't block movement.
export type Loophole_Curtain = {
    entityType: 'CURTAIN';
    edgePosition: Loophole_EdgePosition;
};

// A barrier that blocks vision, but only blocks movement in one direction.
export type Loophole_OneWay = {
    entityType: 'ONE_WAY';
    edgePosition: Loophole_EdgePosition;
    // Determines which direction the OneWay faces.
    // If true, the player can move away from edgePosition.cell.
    // If false, the player can move towards edgePosition.cell.
    flipDirection: boolean;
};

// A barrier that blocks movement, but doesn't block vision.
export type Loophole_Glass = {
    entityType: 'GLASS';
    edgePosition: Loophole_EdgePosition;
};

// An item that the player can move to hold down buttons.
export type Loophole_Staff = {
    entityType: 'STAFF';
    position: Loophole_Int2;
};

// A square in which time doesn't advance.
export type Loophole_Sauce = {
    entityType: 'SAUCE';
    position: Loophole_Int2;
};

// An item that gives the player a status effect.
export type Loophole_Mushroom = {
    entityType: 'MUSHROOM';
    position: Loophole_Int2;
    mushroomType: 'BLUE' | 'GREEN' | 'RED';
};

// A square that removes status effects from the player.
export type Loophole_CleansingPool = {
    entityType: 'CLEANSING_POOL';
    position: Loophole_Int2;
};

// An entity that activates a channel when overlapping with a Player or a Staff.
export type Loophole_Button = {
    entityType: 'BUTTON';
    position: Loophole_Int2;
    // When this Button is activated, Doors and Wires that share this channel will become activated.
    channel: Loophole_Int;
};

// A barrier the blocks the movement unless a channel is activated.
export type Loophole_Door = {
    entityType: 'DOOR';
    edgePosition: Loophole_EdgePosition;
    // The door opens when this channel is activated.
    channel: Loophole_Int;
};

// A decoration that can indicate connections between buttons and doors.
//
//          | Right |  Up   | Left  | Down
// ---------+-------+-------+-------+-------
// Straight |   -   |   |   |   -   |   |
// ---------+-------+-------+-------+-------
// Corner   |   ┘   |   ┐   |   ┌   |   └
//
export type Loophole_Wire = {
    entityType: 'WIRE';
    position: Loophole_Int2;
    rotation: Loophole_Direction;
    sprite: 'STRAIGHT' | 'CORNER';
    // The wire lights up when this channel is activated.
    channel: Loophole_Int;
};

//
// Entity Overlap Rules
//
//              | TimeMachine | Staff | Sauce | Mushroom | Button | Wire
// -------------+-------------+-------+-------+----------+--------+-------
//  TimeMachine |      N      |   N   |   N   |    N     |    N   |   N
//  Staff       |      -      |   N   |   Y   |    Y     |    Y   |   Y
//  Sauce       |      -      |   -   |   N   |    Y     |    Y   |   Y
//  Mushroom    |      -      |   -   |   -   |    N     |    Y   |   Y
//  Button      |      -      |   -   |   -   |    -     |    N   |   Y
//  Wire        |      -      |   -   |   -   |    -     |    -   |   N
//
//              | Wall | Curtain | OneWay | Glass | Door
// -------------+------+---------+--------+-------+------
//  Wall        |   N  |    N    |    N   |   N   |   N
//  Curtain     |   -  |    N    |    N   |   N   |   Y
//  OneWay      |   -  |    -    |    N   |   N   |   Y
//  Glass       |   -  |    -    |    -   |   N   |   N
//  Door        |   -  |    -    |    -   |   -   |   N
//
