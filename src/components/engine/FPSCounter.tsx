import { cn } from '@/lib/utils';
import type { Stats, TraceFrame } from '@/utils/engine/systems/stats';
import type { LevelEditor } from '@/utils/levelEditor';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

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
        <p className={cn('text-white font-mono', className)}>
            FPS: {stats.fps}
            <br />
            <TraceFrameList
                traces={stats.traces}
                importantTraces={importantTraces.current}
                currentTime={performance.now()}
            />
        </p>
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

        const key = parentName ? `${parentName} > ${name}` : name;
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
