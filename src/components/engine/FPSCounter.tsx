import { cn } from '@/lib/utils';
import type { Stats, TraceFrame } from '@/utils/engine/systems/stats';
import type { LevelEditor } from '@/utils/levelEditor';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

interface FPSCounterProps {
    editorRef: React.RefObject<LevelEditor | null>;
    className?: string;
}

export function FPSCounter({ editorRef, className }: FPSCounterProps) {
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
            <TraceFrameList traces={stats.traces} />
        </p>
    );
}

interface TraceFrameListProps {
    traces: TraceFrame[];
    depth?: number;
    parentName?: string;
}

export function TraceFrameList({ traces, depth = 0, parentName }: TraceFrameListProps) {
    return traces.map((trace) => {
        const name = parentName ? `${parentName} > ${trace.name}` : trace.name;
        const { subFrames, time, numCalls = 1 } = trace;

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
                                parentName={name}
                                depth={depth + 1}
                            />
                        </span>
                    </>
                )}
                <br />
            </span>
        );
    });
}
