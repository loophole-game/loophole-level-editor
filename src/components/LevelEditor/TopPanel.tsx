import { Camera, RefreshCw, Rocket, Settings } from 'lucide-react';
import { useAppStore, useCurrentLevel } from '../../utils/store';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import Panel from './Panel';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const DEFAULT_LEVEL_NAME = 'Untitled Level';

export default function TopPanel() {
    const currentLevel = useCurrentLevel();
    const updateLevel = useAppStore((state) => state.updateLevel);
    const userSettings = useAppStore((state) => state.userSettings);
    const setUserSettings = useAppStore((state) => state.setUserSettings);
    const resetLevel = useAppStore((state) => state.resetLevel);
    const setCameraTarget = useAppStore((state) => state.setCameraTarget);
    if (!currentLevel) return null;

    const { name } = currentLevel;

    const downloadLevel = () => {
        const level = currentLevel;
        const levelJSON = JSON.stringify(level, null, 2);
        const blob = new Blob([levelJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
    };

    return (
        <Panel className="flex items-center w-full">
            <Input
                type="text"
                className="border-none outline-none !text-xl font-bold"
                value={name}
                placeholder={DEFAULT_LEVEL_NAME}
                onChange={(e) => updateLevel(currentLevel.id, { name: e.target.value })}
            />
            <Button variant="outline" onClick={downloadLevel}>
                <Rocket className="size-5" />
                Test Level
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Settings className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel>Level Settings</DropdownMenuLabel>
                    <DropdownMenuItem
                        onClick={() =>
                            setCameraTarget({
                                position: { x: 0, y: 0 },
                                rotation: 0,
                                zoom: 1,
                            })
                        }
                    >
                        <Camera /> Reset Viewport
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => resetLevel(currentLevel.id)}>
                        <RefreshCw /> Clear Level
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Editor Settings</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={userSettings.scrollDirection === -1}
                        onCheckedChange={(checked) =>
                            setUserSettings({ scrollDirection: checked ? -1 : 1 })
                        }
                    >
                        Invert Scroll Direction
                    </DropdownMenuCheckboxItem>
                    <div className="px-2 py-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Scroll Sensitivity</span>
                            <span className="text-sm text-muted-foreground">
                                {userSettings.scrollSensitivity.toFixed(1)}x
                            </span>
                        </div>
                        <Slider
                            value={[userSettings.scrollSensitivity]}
                            onValueChange={([value]) =>
                                setUserSettings({ scrollSensitivity: value })
                            }
                            min={0.2}
                            max={2}
                            step={0.05}
                            className="w-full"
                        />
                    </div>
                    <DropdownMenuCheckboxItem
                        checked={userSettings.showEngineStats}
                        onCheckedChange={(checked) => setUserSettings({ showEngineStats: checked })}
                    >
                        Show Engine Stats
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </Panel>
    );
}
