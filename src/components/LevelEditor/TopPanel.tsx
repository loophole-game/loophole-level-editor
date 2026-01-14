import { Rocket } from 'lucide-react';
import { useAppStore, useCurrentLevel } from '../../utils/stores';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Panel } from '../Panel';
import { DEFAULT_LEVEL_NAME, exportLoopholeInternalLevel, formatToSnakeCase } from '@/utils/utils';
import clsx from 'clsx';
import { Separator } from '../ui/separator';
import { SettingsDropdown } from './SettingsDropdown';
import { ColorPalettePicker } from './ColorPalettePicker';
import { MetadataEditor } from './MetadataEditor';

interface TopPanelProps {
    className?: string;
}

export default function TopPanel({ className }: TopPanelProps) {
    const updateLevel = useAppStore((state) => state.updateLevel);
    const currentLevel = useCurrentLevel();
    if (!currentLevel) return null;

    const { name } = currentLevel;
    const levelName = name.trim() || DEFAULT_LEVEL_NAME;

    const downloadLevel = () => {
        const level = exportLoopholeInternalLevel(currentLevel);
        const levelJSON = JSON.stringify(level, null, 2);
        const blob = new Blob([levelJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formatToSnakeCase(levelName)}.json`;
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Panel className={clsx('flex items-center w-full', className)}>
            <Input
                type="text"
                className="border-none outline-none text-xl! font-bold"
                value={name}
                placeholder={DEFAULT_LEVEL_NAME}
                onChange={(e) => updateLevel(currentLevel.id, { name: e.target.value })}
            />
            <MetadataEditor />
            <ColorPalettePicker />
            <Separator orientation="vertical" className="mx-2" />
            <Button variant="loophole" onClick={downloadLevel}>
                <Rocket className="size-5" />
                Test Level
            </Button>
            <Separator orientation="vertical" className="mx-2" />
            <SettingsDropdown levelName={levelName} />
        </Panel>
    );
}
