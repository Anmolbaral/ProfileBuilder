import React from 'react';
import { cn } from '@/lib/utils';

export function KeywordTag({ keyword, isMissing = false }: { keyword: string; isMissing?: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-inter text-sm font-bold px-5 py-3 border-2 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 mx-2 my-1.5',
        isMissing 
          ? 'bg-orange-200 text-orange-950 border-orange-500 hover:bg-orange-300' 
          : 'bg-green-200 text-green-950 border-green-500 hover:bg-green-300'
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
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <button
            className={cn(
              'rounded-lg px-6 py-4 border-2 transition-all duration-200 font-semibold min-w-[160px] mb-3 sm:mb-0 shadow-md hover:shadow-lg transform hover:scale-105',
              tab === 'missing' 
                ? 'bg-amber-100 border-amber-400 text-black hover:bg-amber-200' 
                : 'bg-white border-gray-300 hover:bg-gray-100 text-black hover:border-gray-400'
            )}
            onClick={() => setTab('missing')}
          >
            Missing Keywords ({missing.length})
          </button>
          <button
            className={cn(
              'rounded-lg px-6 py-4 border-2 transition-all duration-200 font-semibold min-w-[160px] shadow-md hover:shadow-lg transform hover:scale-105',
              tab === 'found' 
                ? 'bg-green-100 border-green-400 text-black hover:bg-green-200' 
                : 'bg-white border-gray-300 hover:bg-gray-100 text-black hover:border-gray-400'
            )}
            onClick={() => setTab('found')}
          >
            Keywords Found ({found.length})
          </button>
        </div>
        <div className="keyword-tags flex flex-wrap gap-6 p-3 sm:p-4">
          {(tab === 'missing' ? missing : found).map((kw) => (
            <KeywordTag key={kw} keyword={kw} isMissing={tab === 'missing'} />
          ))}
          {(tab === 'missing' ? missing : found).length === 0 && (
            <p className="text-black italic">
              {tab === 'missing' ? 'No missing keywords found.' : 'No keywords found yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}