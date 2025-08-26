import React from 'react';

interface FeedbackProps {
  feedback: {
    overallScore: number;
    strengths?: string[];
    improvements?: Array<{
      section: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    missingKeywords?: string[];
    jobMatchAnalysis?: string;
    jobMatchAnalysisDetailed?: {
      summary: string;
      scoringBreakdown: {
        baselineScreening: number;
        experienceQuality: number;
        projectDepth: number;
        skillsFit: number;
        impactMetrics: number;
        leadershipDifferentiation: number;
        cultureMissionFit: number;
      };
      detailedAnalysis: string[];
    };
    recommendations?: string[];
  };
}

// Helper function for priority badge classes
function getPriorityBadgeClasses(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-900 border-red-500 hover:bg-red-200';
    case 'medium':
      return 'bg-amber-100 text-amber-900 border-amber-500 hover:bg-amber-200';
    case 'low':
      return 'bg-blue-100 text-blue-900 border-blue-500 hover:bg-blue-200';
    default:
      return 'bg-gray-100 text-gray-900 border-gray-500 hover:bg-gray-200';
  }
}

// Helper function for metric bar component
function MetricBar({ label, score }: { label: string; score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 capitalize">
          {label.replace(/([A-Z])/g, ' $1').trim()}
        </span>
        <span className={`text-lg font-bold ${getScoreColor(score)}`}>
          {score}%
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${getBarColor(score)}`}
          style={{ width: `${Math.min(100, score)}%` }}
        ></div>
      </div>
    </div>
  );
}

// Card wrapper component for consistent structure
function FeedbackCardSection({ 
  id, 
  title, 
  subtitle, 
  children 
}: { 
  id: string; 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="card-container mb-8">
      <div className="card-header-responsive">
        <h3 id={id} className="text-card-title">
          {title}
        </h3>
        {subtitle && (
          <p className="text-muted mt-2">
            {subtitle}
          </p>
        )}
      </div>
      <div className="card-content-responsive">
        {children}
      </div>
    </div>
  );
}

// Keyword tag component
function KeywordTag({ keyword, isMissing }: { keyword: string; isMissing: boolean }) {
  const getTagClasses = (isMissing: boolean) => {
    return isMissing
      ? 'bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200'
      : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-900 hover:border-slate-400';
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border transition-colors ${getTagClasses(isMissing)}`}>
      {isMissing ? '❌' : '✅'} {keyword}
    </span>
  );
}

export default function FeedbackCard({ feedback }: FeedbackProps) {
  if (!feedback) return null;

  return (
    <div>
      {/* Strengths */}
      {feedback.strengths && feedback.strengths.length > 0 && (
        <FeedbackCardSection
          id="strengths-section"
          title="✅ Your Strengths"
        >
          <ul className="space-y-3">
            {feedback.strengths.map((strength, index) => (
              <li key={index} className="flex items-start p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                <span className="mr-4 text-blue-600 text-lg leading-7 font-bold flex-shrink-0">✓</span>
                <span className="text-sm leading-relaxed text-black flex-1">{strength}</span>
              </li>
            ))}
          </ul>
        </FeedbackCardSection>
      )}

      {/* Improvements */}
      {feedback.improvements && feedback.improvements.length > 0 && (
        <FeedbackCardSection
          id="improvements-section"
          title="🔧 Areas for Improvement"
        >
          <div className="space-y-6">
            {feedback.improvements.map((improvement, index) => (
              <div key={index} className="border-l-4 border-amber-500 pl-6 py-6 bg-amber-50 rounded-r-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h4 className="text-base font-semibold text-black">
                    {improvement.section}
                  </h4>
                  <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold shadow-md border-2 transition-colors cursor-default ${getPriorityBadgeClasses(improvement.priority)}`}>
                    {improvement.priority} priority
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border-2 border-amber-200 shadow-sm">
                    <strong className="text-red-800 text-base">Issue:</strong>
                    <p className="text-sm leading-relaxed text-black mt-2">{improvement.issue}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border-2 border-amber-200 shadow-sm">
                    <p className="text-sm leading-relaxed text-slate-800">
                      <strong className="text-emerald-800 text-base">Suggestion:</strong>
                    </p>
                    <p className="text-sm leading-relaxed text-slate-800 mt-2">{improvement.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FeedbackCardSection>
      )}



      {/* Enhanced Job Match Analysis */}
      {(feedback.jobMatchAnalysis || feedback.jobMatchAnalysisDetailed) && (
        <FeedbackCardSection
          id="job-match-section"
          title="📊 Enhanced Job Match Analysis"
          subtitle="Comprehensive analysis of your resume's alignment with job requirements"
        >
          {/* Summary */}
          {feedback.jobMatchAnalysis && (
            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800">
                {feedback.jobMatchAnalysis}
              </p>
            </div>
          )}

          {/* Detailed Scoring Breakdown */}
          {feedback.jobMatchAnalysisDetailed && (
            <div className="space-y-6">
              {/* Scoring Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(feedback.jobMatchAnalysisDetailed.scoringBreakdown).map(([key, score]) => (
                  <MetricBar key={key} label={key} score={score} />
                ))}
              </div>

              {/* Detailed Analysis */}
              <div className="mt-6">
                <h4 className="text-base font-semibold mb-4 text-emerald-800">Detailed Analysis</h4>
                <div className="space-y-3">
                  {feedback.jobMatchAnalysisDetailed.detailedAnalysis.map((analysis, index) => (
                    <div key={index} className="flex items-start p-3 bg-white rounded-lg border border-slate-200">
                      <span className="mr-3 text-emerald-600 text-lg">•</span>
                      <span className="text-sm leading-relaxed text-black">{analysis}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </FeedbackCardSection>
      )}

      {/* Recommendations */}
      {feedback.recommendations && feedback.recommendations.length > 0 && (
        <FeedbackCardSection
          id="recommendations-section"
          title="💡 Actionable Recommendations"
        >
          <ul className="space-y-3">
            {feedback.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start p-4 rounded-lg bg-indigo-100 border-2 border-indigo-300 hover:bg-indigo-200 transition-colors shadow-sm">
                <span className="mr-4 text-indigo-600 text-xl leading-7 font-bold flex-shrink-0">💡</span>
                <span className="text-sm leading-relaxed text-black flex-1 font-medium">{recommendation}</span>
              </li>
            ))}
          </ul>
        </FeedbackCardSection>
      )}
    </div>
  );
}