import { useAppStore } from '@/utils/stores';
import { Panel } from '../Panel';
import clsx from 'clsx';
import type { E_Tile } from '@/utils/levelEditor/scenes/grid';
import { useMemo } from 'react';
import {
    calculateSelectionCenter,
    degreesToLoopholeRotation,
    ENTITY_METADATA,
    getLoopholeEntityChannel,
    getLoopholeEntityDirection,
    getLoopholeEntityExtendedType,
    getLoopholeEntityFlipDirection,
    getLoopholeExplosionPeriod,
    getLoopholeExplosionStartTime,
    getLoopholeWireSprite,
    loopholeRotationToDegrees,
    TILE_SIZE,
} from '@/utils/utils';
import { RotateCcw, RotateCw, Trash } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import type { Loophole_WireSprite } from '@/utils/levelEditor/externalLevelSchema';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import type { LevelEditor } from '@/utils/levelEditor';

interface EditorUI {
    editorRef: React.RefObject<LevelEditor | null>;
}

function computeSharedValue<T>(
    tiles: E_Tile[],
    getter: (tile: E_Tile) => T | null,
): { sharedValue: boolean; value: T | null } {
    let shared = true;
    let value: T | null = null;
    for (const tile of tiles) {
        const tileValue = getter(tile);
        if (tileValue !== null) {
            if (value !== null && value !== tileValue) {
                shared = false;
                break;
            }
            value = tileValue;
        }
    }

    return { sharedValue: shared, value };
}

interface EntityInspectorProps extends EditorUI {
    className?: string;
}

export function EntityInspector({ editorRef, className }: EntityInspectorProps) {
    const selectedTiles = useAppStore((state) => state.selectedTiles);
    const numTiles = Object.keys(selectedTiles).length;

    return (
        <Panel className={clsx(className, 'flex flex-col gap-4')}>
            {numTiles > 0 ? (
                <MultiTileContent
                    editorRef={editorRef}
                    selectedTiles={Object.values(selectedTiles)}
                />
            ) : (
                <EmptyContent />
            )}
        </Panel>
    );
}

interface MultiTileContentProps extends EditorUI {
    selectedTiles: E_Tile[];
}

function MultiTileContent({ editorRef, selectedTiles }: MultiTileContentProps) {
    const setSelectedTiles = useAppStore((state) => state.setSelectedTiles);

    const tileInfo = useMemo(() => {
        return selectedTiles.map((tile) => ({
            entity: tile.entity,
            extendedType: getLoopholeEntityExtendedType(tile.entity),
        }));
    }, [selectedTiles]);
    const multiple = selectedTiles.length > 1;
    const primaryTile = selectedTiles[0];
    const primaryInfo = tileInfo[0];
    const allSameType = tileInfo.every((ti) => ti.extendedType === primaryInfo.extendedType);
    const name = allSameType
        ? `${
              multiple ? `${tileInfo.length} ` : ''
          }${ENTITY_METADATA[primaryInfo.extendedType].name}${multiple ? 's' : ''}`
        : `${tileInfo.length} Entities`;

    const rotateEntities = (rotation: 90 | -90) => {
        const center = calculateSelectionCenter(selectedTiles);
        const entities = editorRef.current?.rotateEntities(
            selectedTiles.map((t) => t.entity),
            {
                x: center.x / TILE_SIZE,
                y: -center.y / TILE_SIZE,
            },
            rotation,
        );
        if (entities) {
            setSelectedTiles(entities);
        }
    };

    return (
        <>
            <div className="flex gap-2 items-center">
                <h2>{name}</h2>
                {selectedTiles.length === 1 && primaryTile.variant === 'entrance' && (
                    <Badge
                        variant="destructive"
                        className="bg-blue-500 text-white dark:bg-blue-600"
                    >
                        Entrance
                    </Badge>
                )}
                {selectedTiles.some((t) => t.variant === 'default') && (
                    <button
                        onClick={() =>
                            editorRef.current?.removeLoopholeEntities(
                                selectedTiles.map((t) => t.entity),
                            )
                        }
                        className="ml-auto"
                    >
                        <Trash size={20} />
                    </button>
                )}
            </div>
            <div className="grid grid-cols-[min-content_1fr] gap-2 items-center justify-items-start">
                <Label>Rotate</Label>
                <div className="flex gap-2">
                    <Button size="icon-lg" variant="loophole" onClick={() => rotateEntities(90)}>
                        <RotateCcw />
                    </Button>
                    <Button size="icon-lg" variant="loophole" onClick={() => rotateEntities(-90)}>
                        <RotateCw />
                    </Button>
                </div>
                {tileInfo.every((ti) => ENTITY_METADATA[ti.extendedType].hasChannel) && (
                    <ChannelInput editorRef={editorRef} selectedTiles={selectedTiles} />
                )}
                {tileInfo.every((ti) => ENTITY_METADATA[ti.extendedType].hasWireSprite) && (
                    <WireInput editorRef={editorRef} selectedTiles={selectedTiles} />
                )}
                {tileInfo.every((ti) => ENTITY_METADATA[ti.extendedType].hasFlipDirection) && (
                    <FlipDirectionInput editorRef={editorRef} selectedTiles={selectedTiles} />
                )}
                {tileInfo.every((ti) => ENTITY_METADATA[ti.extendedType].hasDirection) && (
                    <ExplosionInput editorRef={editorRef} selectedTiles={selectedTiles} />
                )}
            </div>
        </>
    );
}

interface ChannelInputProps extends EditorUI {
    selectedTiles: E_Tile[];
}

function ChannelInput({ editorRef, selectedTiles }: ChannelInputProps) {
    const { sharedValue, value: channel } = useMemo(
        () => computeSharedValue(selectedTiles, (tile) => getLoopholeEntityChannel(tile.entity)),
        [selectedTiles],
    );

    return (
        <>
            <Label htmlFor="channel-input">Channel</Label>
            <Input
                id="channel-input"
                name="channel"
                type="number"
                value={sharedValue && channel !== null ? channel : ''}
                placeholder={sharedValue ? undefined : '— multiple values —'}
                onChange={(e) => {
                    const newChannel = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    if (newChannel !== null && newChannel !== undefined) {
                        editorRef.current?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { channel: newChannel },
                        );
                    }
                }}
                className="border border-gray-300 rounded-md px-2 py-1"
            />
        </>
    );
}

interface WireInputProps extends EditorUI {
    selectedTiles: E_Tile[];
}

function WireInput({ editorRef, selectedTiles }: WireInputProps) {
    const { sharedValue, value: sprite } = useMemo(
        () => computeSharedValue(selectedTiles, (tile) => getLoopholeWireSprite(tile.entity)),
        [selectedTiles],
    );

    return (
        <>
            <Label htmlFor="wire-input">Direction</Label>
            <ToggleGroup
                id="wire-input"
                type="single"
                variant="outline"
                value={sharedValue && sprite !== null ? sprite : undefined}
                onValueChange={(value) => {
                    if (value) {
                        editorRef.current?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { sprite: value as Loophole_WireSprite },
                        );
                    }
                }}
            >
                <ToggleGroupItem value="STRAIGHT">Straight</ToggleGroupItem>
                <ToggleGroupItem value="CORNER">Corner</ToggleGroupItem>
            </ToggleGroup>
        </>
    );
}

interface FlipDirectionInputProps extends EditorUI {
    selectedTiles: E_Tile[];
}

function FlipDirectionInput({ editorRef, selectedTiles }: FlipDirectionInputProps) {
    const { sharedValue, value: flipDirection } = useMemo(
        () =>
            computeSharedValue(selectedTiles, (tile) =>
                getLoopholeEntityFlipDirection(tile.entity),
            ),
        [selectedTiles],
    );

    return (
        <>
            <Label htmlFor="flip-direction-input">Flipped</Label>
            <Switch
                id="flip-direction-input"
                checked={sharedValue && flipDirection !== null ? flipDirection : false}
                onCheckedChange={(checked) => {
                    if (checked !== undefined) {
                        editorRef.current?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { flipDirection: checked },
                        );
                    }
                }}
            />
        </>
    );
}

interface ExplosionInputProps extends EditorUI {
    selectedTiles: E_Tile[];
}

function ExplosionInput({ editorRef, selectedTiles }: ExplosionInputProps) {
    const { value: direction } = useMemo(
        () => computeSharedValue(selectedTiles, (tile) => getLoopholeEntityDirection(tile.entity)),
        [selectedTiles],
    );
    const { value: period } = useMemo(
        () => computeSharedValue(selectedTiles, (tile) => getLoopholeExplosionPeriod(tile.entity)),
        [selectedTiles],
    );
    const { value: startTime } = useMemo(
        () =>
            computeSharedValue(selectedTiles, (tile) => getLoopholeExplosionStartTime(tile.entity)),
        [selectedTiles],
    );

    return (
        <>
            <Label htmlFor="explosion-direction-input">Direction</Label>
            <Button
                id="explosion-direction-input"
                variant="loophole"
                onClick={() =>
                    editorRef.current?.updateEntities(
                        selectedTiles.map((t) => t.entity),
                        {
                            direction: degreesToLoopholeRotation(
                                loopholeRotationToDegrees(direction ?? 'RIGHT') + 180,
                            ),
                        },
                    )
                }
            >
                Flip
            </Button>
            <Label htmlFor="explosion-direction-input">Rate</Label>
            <span className="flex items-center gap-2 text-sm">
                <Input
                    id="explosion-period-input"
                    type="number"
                    className="w-18"
                    value={period !== null ? period : ''}
                    onChange={(e) =>
                        editorRef.current?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { period: parseFloat(e.target.value) },
                        )
                    }
                />{' '}
                turn{period === 1 ? '' : 's'}/cell
            </span>
            <Label htmlFor="explosion-direction-input">Start at</Label>
            <span className="flex items-center gap-2 text-sm">
                <Input
                    id="explosion-start-time-input"
                    type="number"
                    className="w-18"
                    value={startTime !== null ? startTime : ''}
                    onChange={(e) =>
                        editorRef.current?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { startTime: Math.round(parseFloat(e.target.value)) },
                        )
                    }
                />{' '}
                turns in
            </span>
        </>
    );
}

function EmptyContent() {
    return (
        <>
            <h2>No Entity Selected</h2>
        </>
    );
}
