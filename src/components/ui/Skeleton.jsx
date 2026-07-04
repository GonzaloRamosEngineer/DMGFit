import React from 'react';
import { cn } from '../../utils/cn';

const Skeleton = ({ className, ...props }) => (
  <div className={cn('animate-pulse bg-muted rounded-md', className)} {...props} />
);

// Helper que replica el layout de una KPI/metric card en estado de carga.
const SkeletonCard = ({ className }) => (
  <div className={cn('bg-card border border-border rounded-3xl p-6 h-40 flex flex-col', className)}>
    <div className="flex justify-between items-start mb-4">
      <div className="space-y-2 w-1/2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      <Skeleton className="h-12 w-12 rounded-2xl" />
    </div>
    <div className="mt-auto pt-4 border-t border-border">
      <Skeleton className="h-4 w-1/3 rounded-full" />
    </div>
  </div>
);

export { Skeleton, SkeletonCard };
export default Skeleton;
