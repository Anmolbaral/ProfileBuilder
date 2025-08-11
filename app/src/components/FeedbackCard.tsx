// Removed unused Card imports as we now use custom responsive divs
import { KeywordTag } from '@/features/results/components/KeywordHub';

interface FeedbackProps {
  feedback: {
    overallScore?: number;
    strengths?: string[];
    improvements?: Array<{
      section: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    missingKeywords?: string[];
    jobMatchAnalysis?: string;
    recommendations?: string[];
  };
}

export default function FeedbackCard({ feedback }: FeedbackProps) {
  if (!feedback) return null;

  return (
    <div className="results-page__content">

      {/* Strengths */}
      {feedback.strengths && feedback.strengths.length > 0 && (
        <div className="card-container" style={{background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '1px solid #93c5fd'}}>
          <div className="card-header-responsive">
            <h3 className="text-card-title">✅ Your Strengths</h3>
          </div>
          <div className="card-content-responsive">
            <ul className="flex flex-col gap-5">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors">
                  <span className="mr-4 text-black text-lg leading-7 font-bold flex-shrink-0">✓</span>
                  <span className="text-body text-black flex-1 leading-7">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Improvements */}
      {feedback.improvements && feedback.improvements.length > 0 && (
        <div className="card-container" style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)', border: '1px solid #f59e0b'}}>
          <div className="card-header-responsive">
            <h3 className="text-card-title">🔧 Areas for Improvement</h3>
          </div>
          <div className="card-content-responsive">
            <div className="improvement-items-container space-y-10">
              {feedback.improvements.map((improvement, index) => (
                <div key={index} className="border-l-4 border-amber-500 pl-10 py-8 mb-8 bg-amber-50 rounded-r-lg shadow-sm hover:shadow-md transition-shadow mx-2">
                  <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <h4 className="text-section-label text-black font-semibold mr-4">{improvement.section}</h4>
                    <span className={`inline-flex items-center rounded-full px-6 py-3 text-sm font-bold shadow-md border-2 ${
                      improvement.priority === 'high' ? 'bg-red-200 text-red-950 border-red-600 hover:bg-red-300' :
                      improvement.priority === 'medium' ? 'bg-yellow-200 text-yellow-950 border-yellow-600 hover:bg-yellow-300' :
                      'bg-blue-200 text-blue-950 border-blue-600 hover:bg-blue-300'
                    } transition-colors cursor-default`}>
                      {improvement.priority} priority
                    </span>
                  </div>
                  <div className="space-y-6">
                    <div className="p-5 bg-white rounded-lg border-2 border-amber-200 shadow-sm mx-2">
                      <p className="text-body text-black leading-relaxed"><strong className="text-red-800 text-lg">Issue:</strong></p>
                      <p className="text-body text-black leading-relaxed mt-3">{improvement.issue}</p>
                    </div>
                    <div className="p-5 bg-white rounded-lg border-2 border-amber-200 shadow-sm mx-2">
                      <p className="text-body text-black leading-relaxed"><strong className="text-green-800 text-lg">Suggestion:</strong></p>
                      <p className="text-body text-black leading-relaxed mt-3">{improvement.suggestion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Missing Keywords */}
      {feedback.missingKeywords && feedback.missingKeywords.length > 0 && (
        <div className="card-container" style={{background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', border: '1px solid #a855f7'}}>
          <div className="card-header-responsive">
            <h3 className="text-card-title">🔍 Missing Keywords</h3>
          </div>
          <div className="card-content-responsive">
            <p className="mb-6 text-body text-black">Consider adding these keywords to improve your resume's ATS score:</p>
            <div className="missing-keyword-tags flex flex-wrap gap-5 sm:gap-6 p-2">
              {feedback.missingKeywords.map((keyword, index) => (
                <KeywordTag key={index} keyword={keyword} isMissing={true} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job Match Analysis */}
      {feedback.jobMatchAnalysis && (
        <div className="card-container" style={{background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1px solid #10b981'}}>
          <div className="card-header-responsive">
            <h3 className="text-card-title">📊 Job Match Analysis</h3>
          </div>
          <div className="card-content-responsive">
            <p className="text-body">{feedback.jobMatchAnalysis}</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {feedback.recommendations && feedback.recommendations.length > 0 && (
        <div className="card-container" style={{background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', border: '1px solid #6366f1'}}>
          <div className="card-header-responsive">
            <h3 className="text-card-title">💡 Actionable Recommendations</h3>
          </div>
          <div className="card-content-responsive">
            <ul className="flex flex-col gap-5">
              {feedback.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start p-5 rounded-lg bg-indigo-100 border-2 border-indigo-300 hover:bg-indigo-200 transition-colors shadow-md">
                  <span className="mr-5 text-black text-xl leading-7 font-bold flex-shrink-0">💡</span>
                  <span className="text-body text-black flex-1 leading-7 font-medium">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}