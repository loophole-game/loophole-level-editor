import clsx from 'clsx';
import { cn } from '../../lib/utils';
import type { Loophole_ExtendedEntityType } from '../../utils/levelEditor/externalLevelSchema';
import { useAppStore, useCurrentLevel } from '../../utils/stores';
import { COLOR_PALETTE_METADATA, ENTITY_METADATA } from '../../utils/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Panel } from '../Panel';

interface TilePickerProps {
    className?: string;
}

export default function TilePicker({ className }: TilePickerProps) {
    const brushEntityType = useAppStore((state) => state.brushEntityType);
    const setBrushEntityType = useAppStore((state) => state.setBrushEntityType);
    const lockedLayers = useAppStore((state) => state.lockedLayers);
    const currentLevel = useCurrentLevel();
    const colorPalette = currentLevel?.colorPalette ?? null;

    return (
        <Panel className={clsx('flex h-min w-fit', className)}>
            <div className="grid grid-cols-3">
                {Object.entries(ENTITY_METADATA).map(
                    ([entityType, metadata], i) =>
                        !metadata.hideInPicker && (
                            <Tooltip key={entityType}>
                                <TooltipTrigger asChild>
                                    <button
                                        draggable={
                                            !lockedLayers[entityType as Loophole_ExtendedEntityType]
                                        }
                                        className={cn(
                                            'relative size-16 aspect-square pixelated-image border-2 p-1 rounded-lg transition-all cursor-grab active:cursor-grabbing',
                                            'disabled:opacity-50 disabled:cursor-not-allowed',
                                            'focus:outline-none focus-visible:outline-none',
                                            {
                                                'border-transparent!':
                                                    brushEntityType !== entityType,
                                                'border-background!':
                                                    brushEntityType === entityType,
                                            },
                                        )}
                                        onClick={() =>
                                            setBrushEntityType(
                                                brushEntityType === entityType
                                                    ? null
                                                    : (entityType as Loophole_ExtendedEntityType),
                                            )
                                        }
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('entityType', entityType);
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        disabled={
                                            lockedLayers[entityType as Loophole_ExtendedEntityType]
                                        }
                                    >
                                        <img
                                            src={
                                                entityType === 'WALL' && colorPalette !== null
                                                    ? COLOR_PALETTE_METADATA[colorPalette].wallImage
                                                    : metadata.src
                                            }
                                            alt={metadata.name}
                                            width={64}
                                            height={64}
                                            draggable={false}
                                        />
                                        {i < 10 && (
                                            <div className="flex items-center justify-center absolute top-0 right-0 bg-black/50 rounded-full size-4 text-xs">
                                                {(i + 1) % 10}
                                            </div>
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="pointer-events-none">
                                    {metadata.name}
                                </TooltipContent>
                            </Tooltip>
                        ),
                )}
            </div>
        </Panel>
    );
}
