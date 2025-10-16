
// Must have an integer value.
type Int = number;

// Represents a position in the level.
export type Position = {
    x: Int;
    y: Int;
};

// Represents the position of an edge between two tiles.
type EdgePosition = {
    cell: Position;
    alignment: "RIGHT" | "TOP";
};

// Represents a direction in the level.
// A direction can also represent a rotation, in which case it encodes
// the rotation from "RIGHT" to the direction. For example:
//     - "RIGHT" = 0 deg
//     - "UP"    = 90 deg counter-clockwise
//     - "LEFT"  = 180 deg counter-clockwise
//     - "DOWN"  = 270 deg counter-clockwise
type Direction = "RIGHT" | "UP" | "LEFT" | "DOWN";

export type Level = {
    // The entity for the time machine that the player will spawn inside.
    entrance: TimeMachine;
    // The position where the level exit will be created. This position must not be blocked.
    exitPosition: Position;
    // A list of all entities in the level, except for the entrance and exit.
    // There are limitations on which entities can share a square with one another, although those rules are more complex.
    entities: Entity[];
};

export type Entity = TimeMachine | Wall | Curtain | OneWay | Glass | Staff | Sauce | Mushroom | Button | Door | Wire;

// A time machine, including the walls and doors around it.
type TimeMachine = {
    entityType: "TIME_MACHINE";
    position: Position;
    // The rotation of the time machine. Aligns with the direction the player will move when going through.
    rotation: Direction;
};

// A barrier that blocks vision and movement.
type Wall = {
    entityType: "WALL";
    edgePosition: EdgePosition;
};

// A barrier that blocks vision, but doesn't block movement.
type Curtain = {
    entityType: "CURTAIN";
    edgePosition: EdgePosition;
};

// A barrier that blocks vision, but only blocks movement in one direction.
type OneWay = {
    entityType: "ONE_WAY";
    edgePosition: EdgePosition;
    // Determines which direction the OneWay faces.
    // If true, the player can move away from edgePosition.cell.
    // If false, the player can move towards edgePosition.cell.
    flipDirection: boolean;
};

// A barrier that blocks movement, but doesn't block vision.
type Glass = {
    entityType: "GLASS";
    edgePosition: EdgePosition;
};

// An item that the player can move to hold down buttons.
type Staff = {
    entityType: "STAFF";
    position: Position;
};

// A square in which time doesn't advance.
type Sauce = {
    entityType: "SAUCE";
    position: Position;
};

// An item that gives the player a status effect.
type Mushroom = {
    entityType: "STAFF";
    mushroomType: "BLUE" | "GREEN" | "RED";
};

// A square that removes status effects from the player.
type CleansingPool = {
    entityType: "STAFF";
    position: Position;
};

// An entity that activates a channel when overlapping with a Player or a Staff.
type Button = {
    entityType: "BUTTON";
    // When this Button is activated, Doors and Wires that share this channel will become activated.
    channel: Int;
};

type Door = {
    entityType: "DOOR";
    edgePosition: EdgePosition;
    // The door opens when this channel is activated.
    channel: Int;
};

type Wire = {
    position: Position;
    rotation: Direction;
    sprite: "STRAIGHT" | "CORNER";
    // The wire lights up when this channel is activated.
    channel: Int;
};
