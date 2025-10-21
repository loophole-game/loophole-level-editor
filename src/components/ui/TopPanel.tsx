import { useAppStore, useCurrentLevel } from '../../utils/store';
import { Input } from './input';
import Panel from './Panel';

const DEFAULT_LEVEL_NAME = 'Untitled Level';

export default function TopPanel() {
    const currentLevel = useCurrentLevel();
    const updateLevel = useAppStore((state) => state.updateLevel);
    if (!currentLevel) return null;

    const { name } = currentLevel;

    return (
        <Panel className="flex items-center w-full">
            <Input
                type="text"
                className="border-none outline-none !text-xl"
                value={name}
                placeholder={DEFAULT_LEVEL_NAME}
                onChange={(e) => updateLevel({ ...currentLevel, name: e.target.value })}
            />
            <button
                onClick={() =>
                    updateLevel({
                        ...currentLevel,
                        level: {
                            colorPalette: 0,
                            entities: [],
                            entrance: {
                                entityType: 'TIME_MACHINE',
                                position: { x: 0, y: 0 },
                                rotation: 'RIGHT',
                            },
                            exitPosition: { x: 0, y: 0 },
                            version: 0,
                        },
                    })
                }
            >
                reset level
            </button>
        </Panel>
    );
}
