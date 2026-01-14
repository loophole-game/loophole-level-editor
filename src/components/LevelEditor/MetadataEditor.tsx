import { Button } from '../ui/button';
import { CircleQuestionMark, TextInitial } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useAppStore, useCurrentLevel } from '@/utils/stores';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function MetadataEditor() {
    const updateLevel = useAppStore((state) => state.updateLevel);
    const currentLevel = useCurrentLevel();
    if (!currentLevel) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="loophole">
                    <TextInitial className="size-5" />
                    Metadata
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="flex flex-col gap-2 w-96">
                <Label htmlFor="description-input">Description</Label>
                <Textarea
                    id="description-input"
                    name="description"
                    placeholder={'Info about the level...'}
                    className="border-text"
                    value={currentLevel.description}
                    onChange={(e) => updateLevel(currentLevel.id, { description: e.target.value })}
                />
                <div className="flex items-center gap-2 w-full">
                    <Checkbox
                        id="automatically-discover-vision"
                        className="border-text"
                        checked={currentLevel.automaticallyDiscoverVision}
                        onCheckedChange={(checked) =>
                            updateLevel(currentLevel.id, {
                                automaticallyDiscoverVision: checked.valueOf() === true,
                            })
                        }
                    />
                    <Label htmlFor="automatically-discover-vision">
                        Automatically Discover Vision
                    </Label>
                    <Tooltip>
                        <TooltipTrigger>
                            <CircleQuestionMark className="ml-auto size-4 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={18}>
                            <p>
                                If enabled, all reachable regions in this level <br />
                                will be visible to the player as if they had <br />
                                already explored the whole level.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </PopoverContent>
        </Popover>
    );
}
