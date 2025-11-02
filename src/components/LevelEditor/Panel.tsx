import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export default function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('bg-card shadow-lg rounded-md p-2 gap-2 pointer-events-auto', className)}
            {...rest}
        />
    );
}
