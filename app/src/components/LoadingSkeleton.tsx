import React from 'react'

export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton">
      <div className="loading-skeleton-item h-6 w-1/3" />
      <div className="loading-skeleton-item h-4 w-2/3" />
      <div className="loading-skeleton-item h-4 w-full" />
      <div className="loading-skeleton-item h-48" />
    </div>
  )
} 