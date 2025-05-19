export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="loading-skeleton__item loading-skeleton__item--short" />
      <div className="loading-skeleton__item loading-skeleton__item--medium" />
      <div className="loading-skeleton__item loading-skeleton__item--full" />
      <div className="loading-skeleton__item loading-skeleton__item--tall" />
    </div>
  )
} 