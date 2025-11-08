import { type HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'bg-primary shadow-lg rounded-md p-2 gap-2 text-primary-foreground transition-colors',
                className,
            )}
            {...rest}
        />
    );
}
