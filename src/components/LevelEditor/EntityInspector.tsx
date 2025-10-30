import { useAppStore } from '@/utils/store';
import Panel from './Panel';
import clsx from 'clsx';
import type { E_Tile } from '@/utils/levelEditor/scenes/grid';
import { useMemo } from 'react';
import { ENTITY_METADATA, getLoopholeEntityExtendedType } from '@/utils/utils';
import { Trash } from 'lucide-react';

interface EntityInspectorProps {
    className?: string;
}

export function EntityInspector({ className }: EntityInspectorProps) {
    const selectedTiles = useAppStore((state) => state.selectedTiles);
    const numTiles = Object.keys(selectedTiles).length;

    return (
        <Panel className={clsx(className)}>
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
            <div className="flex gap-2">
                <h2>{name}</h2>
                {selectedTiles.length === 1 && primaryTile.isEntrance && (
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-md self-center">
                        Entrance
                    </span>
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
