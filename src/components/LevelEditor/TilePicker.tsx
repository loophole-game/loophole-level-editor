import { cn } from '../../lib/utils';
import type { Loophole_ExtendedEntityType } from '../../utils/levelEditor/externalLevelSchema';
import { useAppStore } from '../../utils/store';
import { ENTITY_METADATA } from '../../utils/utils';
import Panel from './Panel';

export default function TilePicker() {
    const brushEntityType = useAppStore((state) => state.brushEntityType);
    const setBrushEntityType = useAppStore((state) => state.setBrushEntityType);

    return (
        <Panel className="flex h-min w-fit">
            <div className="grid grid-cols-4 gap-2 ">
                {Object.entries(ENTITY_METADATA).map(([entityType, metadata]) => (
                    <button
                        key={entityType}
                        className={cn(
                            'size-16 aspect-square pixelated-image border-2 border-transparent p-1 rounded-sm',
                            {
                                'border-white': brushEntityType === entityType,
                            },
                        )}
                        onClick={() =>
                            setBrushEntityType(
                                brushEntityType === entityType
                                    ? null
                                    : (entityType as Loophole_ExtendedEntityType),
                            )
                        }
                    >
                        <img src={metadata.src} alt={metadata.name} width={64} height={64} />
                    </button>
                ))}
            </div>
        </Panel>
    );
}
