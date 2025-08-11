import { useState } from 'react';

export function ActionChecklist({ items = [] as string[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <div className="card-container">
      <div className="card-header-responsive">
        <h3 className="text-card-title">✅ Your Action Plan</h3>
      </div>
      <div className="card-content-responsive">
        <ul className="flex flex-col gap-6">
          {items.length === 0 && (
            <li className="text-black italic text-center py-12 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              No action items yet.
            </li>
          )}
          {items.map((label, idx) => {
            const id = `action-${idx}`;
            const done = checked[id] || false;
            return (
              <li key={idx} className="flex items-start gap-5 p-5 rounded-lg hover:bg-gray-50 transition-all border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md">
                <input
                  aria-label={label}
                  type="checkbox"
                  checked={done}
                  onChange={() => setChecked((s) => ({ ...s, [id]: !s[id] }))}
                  className="mt-1.5 w-5 h-5 rounded border-2 border-gray-400 text-blue-900 focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 flex-shrink-0 cursor-pointer"
                />
                <span className={done ? 'line-through text-gray-600 leading-7 font-medium' : 'text-black flex-1 leading-7 font-medium'}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}