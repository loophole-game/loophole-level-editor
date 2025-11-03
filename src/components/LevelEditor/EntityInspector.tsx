import { useAppStore } from '@/utils/store';
import Panel from './Panel';
import clsx from 'clsx';
import type { E_Tile } from '@/utils/levelEditor/scenes/grid';
import { useMemo } from 'react';
import {
    ENTITY_METADATA,
    getLoopholeEntityChannel,
    getLoopholeEntityExtendedType,
} from '@/utils/utils';
import { Trash } from 'lucide-react';
import { Badge } from '../ui/badge';

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

interface EntityInspectorProps {
    className?: string;
}

export function EntityInspector({ className }: EntityInspectorProps) {
    const selectedTiles = useAppStore((state) => state.selectedTiles);
    const numTiles = Object.keys(selectedTiles).length;

    return (
        <Panel className={clsx(className, 'flex flex-col gap-4')}>
            {numTiles > 0 ? (
                <MultiTileContent selectedTiles={Object.values(selectedTiles)} />
            ) : (
                <EmptyContent />
            )}
        </Panel>
    );
}

interface MultiTileContentProps {
    selectedTiles: E_Tile[];
}

function MultiTileContent({ selectedTiles }: MultiTileContentProps) {
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

    return (
        <>
            <div className="flex gap-2 items-center">
                <h2>{name}</h2>
                {selectedTiles.length === 1 && primaryTile.isEntrance && (
                    <Badge
                        variant="destructive"
                        className="bg-blue-500 text-white dark:bg-blue-600"
                    >
                        Entrance
                    </Badge>
                )}
                {(multiple || !primaryTile.isEntrance) && (
                    <button
                        onClick={() =>
                            window.engine?.removeEntities(selectedTiles.map((t) => t.entity))
                        }
                        className="ml-auto"
                    >
                        <Trash size={20} />
                    </button>
                )}
            </div>
            {tileInfo.every((ti) => ENTITY_METADATA[ti.extendedType].hasChannel) && (
                <ChannelInput selectedTiles={selectedTiles} />
            )}
        </>
    );
}

interface ChannelInputProps {
    selectedTiles: E_Tile[];
}

function ChannelInput({ selectedTiles }: ChannelInputProps) {
    const { sharedValue, value: channel } = useMemo(
        () => computeSharedValue(selectedTiles, (tile) => getLoopholeEntityChannel(tile.entity)),
        [selectedTiles],
    );

    return (
        <div className="flex gap-2 w-full items-center">
            <label htmlFor="channel-input">Channel:</label>
            <input
                type="number"
                id="channel-input"
                name="channel"
                value={sharedValue && channel !== null ? channel : ''}
                placeholder={sharedValue ? undefined : '— multiple values —'}
                onChange={(e) => {
                    const newChannel = e.target.value === '' ? null : parseInt(e.target.value, 10);
                    if (newChannel !== null && newChannel !== undefined) {
                        window.engine?.updateEntities(
                            selectedTiles.map((t) => t.entity),
                            { channel: newChannel },
                        );
                    }
                }}
                className="w-full border border-gray-300 rounded-md px-2 py-1"
            />
        </div>
    );
}

function EmptyContent() {
    return (
        <>
            <h2>No Entity Selected</h2>
        </>
    );
}
