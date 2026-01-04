import { cn } from '@/lib/utils';
import type { Stats, TraceFrame } from '@/utils/engine/systems/stats';
import type { LevelEditor } from '@/utils/levelEditor';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import type { CacheStats } from '@/utils/engine/types';

const IMPORTANT_TRACE_THRESHOLD = 0.2;
const IMPORTANT_TRACE_STALE_TIME = 5000;

interface FPSCounterProps {
    editorRef: React.RefObject<LevelEditor | null>;
    className?: string;
}

export function FPSCounter({ editorRef, className }: FPSCounterProps) {
    const importantTraces = useRef<Map<string, number>>(new Map());
    const [stats, setStats] = useState<Stats | null>(null);
    useEffect(() => {
        const interval = setInterval(() => {
            if (editorRef.current) {
                setStats(editorRef.current.stats);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [editorRef]);

    if (!stats) return null;

    return (
        <div className={cn('text-white font-mono flex flex-col items-end', className)}>
            <p className="pointer-events-none">
                FPS: {stats.fps}
                <br />
                <br />
                <TraceFrameList
                    traces={stats.traces}
                    importantTraces={importantTraces.current}
                    currentTime={performance.now()}
                />
                {stats.renderCommands && (
                    <>
                        Render Commands
                        <span className="text-xs">
                            <br />
                            <CacheSummary name="transform" stats={stats.renderCommands.transform} />
                            <CacheSummary name="setStyle" stats={stats.renderCommands.setStyle} />
                            <CacheSummary
                                name="setOpacity"
                                stats={stats.renderCommands.setOpacity}
                            />
                            <CacheSummary name="drawRect" stats={stats.renderCommands.drawRect} />
                            <CacheSummary
                                name="drawEllipse"
                                stats={stats.renderCommands.drawEllipse}
                            />
                            <CacheSummary name="drawLine" stats={stats.renderCommands.drawLine} />
                            <CacheSummary name="drawImage" stats={stats.renderCommands.drawImage} />
                            <br />
                        </span>
                    </>
                )}
            </p>
            <div className="flex items-center gap-2 w-56">
                <Label htmlFor="cull-scale">Cull</Label>
                <Slider
                    id="cull-scale"
                    min={0.25}
                    max={1}
                    step={0.01}
                    value={[editorRef.current?.options.cullScale ?? 1]}
                    onValueChange={([value]) => {
                        if (editorRef.current) {
                            editorRef.current.options = {
                                ...editorRef.current.options,
                                cullScale: value,
                            };
                        }
                    }}
                />
            </div>
        </div>
    );
}

interface TraceFrameListProps {
    traces: TraceFrame[];
    importantTraces: Map<string, number>;
    currentTime: number;
    depth?: number;
    parentName?: string;
}

export function TraceFrameList({
    traces,
    importantTraces,
    depth = 0,
    parentName,
    currentTime,
}: TraceFrameListProps) {
    return traces.map((trace) => {
        const name = trace.name;
        const { subFrames, time, numCalls = 1 } = trace;

        const key = (parentName ? `${parentName} > ${name}` : name).split('(')[0];
        if (depth > 0) {
            if (time >= IMPORTANT_TRACE_THRESHOLD) importantTraces.set(key, currentTime);
            else {
                const lastTime = importantTraces.get(key);
                if (!lastTime || currentTime - lastTime > IMPORTANT_TRACE_STALE_TIME) {
                    importantTraces.delete(key);
                    return null;
                }
            }
        }

        return (
            <span
                key={trace.name}
                className={clsx('text-base', {
                    'px-4': depth > 0,
                    'text-sm': depth === 1,
                    'text-xs': depth >= 2,
                })}
            >
                {name}
                {numCalls > 1 && ` (${numCalls})`}: {time.toFixed(1)}ms
                {subFrames.length > 0 && (
                    <>
                        <br />
                        <span>
                            <TraceFrameList
                                traces={subFrames}
                                importantTraces={importantTraces}
                                parentName={name}
                                depth={depth + 1}
                                currentTime={currentTime}
                            />
                        </span>
                    </>
                )}
                <br />
            </span>
        );
    });
}

interface CacheSummaryProps {
    name: string;
    stats: CacheStats;
}

export function CacheSummary({ name, stats }: CacheSummaryProps) {
    if (stats.total === 0) return null;
    return (
        <>
            {`${name}: ${stats.total}${
                stats.cached > 0
                    ? ` (${((stats.cached / (stats.total + stats.cached)) * 100).toFixed(1)}% cached)`
                    : ''
            }`}
            <br />
        </>
    );
}
