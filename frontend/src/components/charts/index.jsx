import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';

/*
 * Recharts pesa ~115 KB gzip. Los gráficos se cargan en un chunk aparte para que
 * el primer render de la landing (y el precache de la PWA) no dependa de él.
 * Mientras tanto se muestra un esqueleto del mismo tamaño para evitar saltos de layout.
 */
const LazyReportCard = lazy(() => import('./ReportCard'));
const LazyAiInsightCard = lazy(() => import('./AiInsightCard'));
const LazyCategoryDonut = lazy(() => import('./CategoryDonut'));

/** Placeholder animado con la forma de una tarjeta. */
function Skeleton({ className }) {
  return <div className={cn('w-full animate-pulse rounded-3xl', className)} aria-hidden="true" />;
}

/** @param {{ className?: string }} props */
export function ReportCard(props) {
  return (
    <Suspense fallback={<Skeleton className="h-[292px] bg-white/10" />}>
      <LazyReportCard {...props} />
    </Suspense>
  );
}

/** @param {{ className?: string }} props */
export function AiInsightCard(props) {
  return (
    <Suspense fallback={<Skeleton className="h-[310px] bg-white/10" />}>
      <LazyAiInsightCard {...props} />
    </Suspense>
  );
}

/** @param {{ className?: string }} props */
export function CategoryDonut(props) {
  return (
    <Suspense fallback={<Skeleton className={cn('h-36 rounded-2xl bg-[#1b1b1b]', props.className)} />}>
      <LazyCategoryDonut {...props} />
    </Suspense>
  );
}
