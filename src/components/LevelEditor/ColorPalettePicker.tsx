import { Paintbrush } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { useAppStore, useCurrentLevel } from '@/utils/stores';
import { COLOR_PALETTE_METADATA, Loophole_ColorPalette } from '@/utils/utils';

export function ColorPalettePicker() {
    const updateLevel = useAppStore((state) => state.updateLevel);
    const currentLevel = useCurrentLevel();
    if (!currentLevel) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="loophole" size="icon">
                    <Paintbrush className="size-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex flex-col gap-2 w-64">
                <h4 className="leading-none font-medium">Color Palette</h4>
                <ToggleGroup
                    type="single"
                    value={currentLevel.colorPalette.toString()}
                    className="w-full"
                    onValueChange={(value) => {
                        if (value) {
                            updateLevel(currentLevel.id, {
                                colorPalette: parseInt(value) as Loophole_ColorPalette,
                            });
                        }
                    }}
                >
                    {Object.values(Loophole_ColorPalette).map((palette) => (
                        <ToggleGroupItem key={palette} value={palette.toString()}>
                            {palette + 1}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <img
                    src={`${COLOR_PALETTE_METADATA[currentLevel.colorPalette].image}`}
                    alt="Color Palette Screenshot"
                    className="rounded-md"
                />
            </PopoverContent>
        </Popover>
    );
}
