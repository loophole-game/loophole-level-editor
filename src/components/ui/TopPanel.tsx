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
        </Panel>
    );
}
