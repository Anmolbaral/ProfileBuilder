
import { motion } from 'framer-motion';

export function ScoreGauge({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="card-container prominent" style={{background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #0ea5e9'}}>
      <div className="card-content-responsive">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <div className="flex-shrink-0">
            <svg width="140" height="140" viewBox="0 0 140 140" aria-label="match score" className="drop-shadow-sm">
              <circle cx="70" cy="70" r={radius + 10} stroke="#e5e7eb" strokeWidth="12" fill="none" />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                stroke={clamped >= 85 ? '#22c55e' : clamped >= 70 ? '#3b82f6' : '#f59e0b'}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
              />
              <text x="70" y="78" textAnchor="middle" className="fill-gray-900 text-3xl font-bold">{clamped}%</text>
            </svg>
          </div>
          <div className="text-center md:text-left space-y-3">
            <div className="text-section-label">Overall Match Score</div>
            <div className={`text-body font-semibold text-lg ${
              clamped >= 85 ? 'text-green-700' : clamped >= 70 ? 'text-blue-700' : 'text-amber-700'
            }`}>
              {clamped >= 85 ? 'Strong Match' : clamped >= 70 ? 'Good Match' : 'Needs Improvement'}
            </div>
            <div className="text-muted text-gray-500 max-w-xs">
              {clamped >= 85 ? 'Your resume aligns excellently with the job requirements.' :
               clamped >= 70 ? 'Your resume shows good alignment with most job requirements.' :
               'Consider incorporating more relevant keywords and skills.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
