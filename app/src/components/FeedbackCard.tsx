// Removed unused Card imports as we now use custom responsive divs

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
            <ul className="space-y-3">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-3 text-blue-800 text-lg leading-7">•</span>
                  <span className="text-body text-blue-900 flex-1">{strength}</span>
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
            <div className="improvement-items-container">
              {feedback.improvements.map((improvement, index) => (
                <div key={index} className="border-l-4 border-amber-400 pl-6 py-2">
                  <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h4 className="text-section-label text-amber-900">{improvement.section}</h4>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      improvement.priority === 'high' ? 'bg-red-100 text-red-800' :
                      improvement.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {improvement.priority} priority
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-body text-amber-800"><strong>Issue:</strong> {improvement.issue}</p>
                    <p className="text-body text-amber-800"><strong>Suggestion:</strong> {improvement.suggestion}</p>
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
            <p className="mb-4 text-body text-purple-800">Consider adding these keywords to improve your resume's ATS score:</p>
            <div className="flex flex-wrap gap-3">
              {feedback.missingKeywords.map((keyword, index) => (
                <span key={index} className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                  {keyword}
                </span>
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
            <ul className="space-y-3">
              {feedback.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-3 text-indigo-800 text-lg leading-7">→</span>
                  <span className="text-body text-indigo-900 flex-1">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}