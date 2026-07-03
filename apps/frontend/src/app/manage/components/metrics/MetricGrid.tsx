"use client";

import MetricCard, { type MetricCardProps } from './MetricCard';

type MetricGridProps = {
  metrics: MetricCardProps[];
  columns?: number;
};

export default function MetricGrid({ metrics, columns = 3 }: MetricGridProps) {
  return (
    <div
      className={`grid gap-4 ${getColumnClass(columns)}`}
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
    </div>
  );
}

function getColumnClass(columns: number) {
  switch (columns) {
    case 2:
      return 'md:grid-cols-2';
    case 4:
      return 'md:grid-cols-2 xl:grid-cols-4';
    default:
      return 'md:grid-cols-2 xl:grid-cols-3';
  }
}
