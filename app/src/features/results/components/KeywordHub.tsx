import React from 'react';
import { cn } from '@/lib/utils';

export function KeywordTag({ keyword, isMissing = false }: { keyword: string; isMissing?: boolean }) {
  return (
    <div
      className={cn(
        'keyword-tag-base',
        isMissing ? 'keyword-tag-missing-light' : 'keyword-tag-found-light'
      )}
    >
      {keyword}
    </div>
  );
}

export function KeywordHub({ missing = [], found = [] }: { missing?: string[]; found?: string[] }) {
  const [tab, setTab] = React.useState<'missing' | 'found'>('missing');
  return (
    <div className="card-container">
      <div className="card-header-responsive">
        <h3 className="text-card-title">🎯 Keywords Analysis</h3>
      </div>
      <div className="card-content-responsive">
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <button
            className={cn(
              'rounded-lg px-4 py-3 border transition-all duration-200 text-body font-medium',
              tab === 'missing' 
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm' 
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 hover:border-gray-300'
            )}
            onClick={() => setTab('missing')}
          >
            <span className="text-body">Missing Keywords ({missing.length})</span>
          </button>
          <button
            className={cn(
              'rounded-lg px-4 py-3 border transition-all duration-200 text-body font-medium',
              tab === 'found' 
                ? 'bg-green-50 border-green-300 text-green-800 shadow-sm' 
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 hover:border-gray-300'
            )}
            onClick={() => setTab('found')}
          >
            <span className="text-body">Keywords Found ({found.length})</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {(tab === 'missing' ? missing : found).map((kw) => (
            <KeywordTag key={kw} keyword={kw} isMissing={tab === 'missing'} />
          ))}
          {(tab === 'missing' ? missing : found).length === 0 && (
            <p className="text-muted text-gray-500 italic">
              {tab === 'missing' ? 'No missing keywords found.' : 'No keywords found yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}