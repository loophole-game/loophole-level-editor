import { cn } from '../../lib/utils';
import type { Loophole_ExtendedEntityType } from '../../utils/editor/externalLevelSchema';
import { useAppStore } from '../../utils/store';
import { ENTITY_METADATA } from '../../utils/utils';
import Panel from './Panel';

export default function TilePicker() {
    const selectedEntityType = useAppStore((state) => state.selectedEntityType);
    const setSelectedEntityType = useAppStore((state) => state.setSelectedEntityType);

    return (
        <Panel className="flex h-min w-fit">
            <div className="grid grid-cols-4 gap-2 ">
                {Object.entries(ENTITY_METADATA).map(([entityType, metadata]) => (
                    <button
                        key={entityType}
                        className={cn(
                            'size-16 aspect-square pixelated-image border-2 border-transparent p-1 rounded-sm',
                            {
                                'border-white': selectedEntityType === entityType,
                                'hover:cursor-pointer': selectedEntityType !== entityType,
                            },
                        )}
                        onClick={() =>
                            setSelectedEntityType(entityType as Loophole_ExtendedEntityType)
                        }
                    >
                        <img src={metadata.src} alt={metadata.name} width={64} height={64} />
                    </button>
                ))}
            </div>
        </Panel>
    );
}
