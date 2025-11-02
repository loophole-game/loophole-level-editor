import { cn } from '../../lib/utils';
import type { Loophole_ExtendedEntityType } from '../../utils/levelEditor/externalLevelSchema';
import { useAppStore } from '../../utils/store';
import { ENTITY_METADATA } from '../../utils/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import Panel from './Panel';

export default function TilePicker() {
    const brushEntityType = useAppStore((state) => state.brushEntityType);
    const setBrushEntityType = useAppStore((state) => state.setBrushEntityType);

    return (
        <Panel className="flex h-min w-fit">
            <div className="grid grid-cols-4 gap-2">
                {Object.entries(ENTITY_METADATA).map(([entityType, metadata]) => (
                    <Tooltip key={entityType}>
                        <TooltipTrigger asChild>
                            <button
                                draggable
                                className={cn(
                                    'size-16 aspect-square pixelated-image border-2 border-transparent p-1 rounded-lg transition-colors cursor-grab active:cursor-grabbing',
                                    {
                                        'border-sidebar': brushEntityType === entityType,
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
                            >
                                <img
                                    src={metadata.src}
                                    alt={metadata.name}
                                    width={64}
                                    height={64}
                                    draggable={false}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>{metadata.name}</TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </Panel>
    );
}
