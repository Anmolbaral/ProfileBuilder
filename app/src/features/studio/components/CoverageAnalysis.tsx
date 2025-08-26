import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface CoverageBucket {
  category: string;
  covered: number;
  total: number;
  percentage: number;
}

interface CoverageAnalysisProps {
  coverage: CoverageBucket[];
  missingKeywords: string[];
  jdText: string;
}

export function CoverageAnalysis({ coverage, missingKeywords, jdText }: CoverageAnalysisProps) {
  const getCoverageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCoverageLabel = (percentage: number) => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Poor';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const extractSkillsFromJD = (text: string): string[] => {
    const commonSkills = [
      'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'docker',
      'kubernetes', 'git', 'html', 'css', 'api', 'rest', 'graphql', 'mongodb',
      'postgresql', 'redis', 'kafka', 'elasticsearch', 'jenkins', 'ci/cd',
      'agile', 'scrum', 'tdd', 'bdd', 'microservices', 'serverless', 'typescript',
      'vue', 'angular', 'next.js', 'express', 'fastapi', 'django', 'spring',
      'terraform', 'ansible', 'jenkins', 'gitlab', 'github', 'jira', 'confluence'
    ];
    
    const jdLower = text.toLowerCase();
    return commonSkills.filter(skill => jdLower.includes(skill));
  };

  const jdSkills = extractSkillsFromJD(jdText);

  return (
    <div className="space-y-8">
      {/* Overall Coverage Summary */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-8 py-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">📊 Coverage Analysis</h3>
          <p className="text-gray-600 text-base leading-relaxed">
            Comprehensive analysis of your resume's alignment with job requirements
          </p>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coverage.map((bucket) => (
              <div key={bucket.category} className="text-center p-6 bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className={`text-5xl font-bold ${getCoverageColor(bucket.percentage)} mb-3`}>
                  {Math.round(Math.min(100, bucket.percentage))}%
                </div>
                <div className="text-lg text-gray-800 mb-3 font-semibold">{bucket.category}</div>
                <div className="text-sm text-gray-500 mb-4">
                  {bucket.covered} of {bucket.total} items
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full ${getProgressBarColor(bucket.percentage)} transition-all duration-500 ease-out`}
                    style={{ width: `${Math.min(100, bucket.percentage)}%` }}
                  ></div>
                </div>
                <div className={`text-sm font-semibold ${getCoverageColor(bucket.percentage)}`}>
                  {getCoverageLabel(bucket.percentage)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills Gap Analysis */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">🎯 Skills Gap Analysis</h3>
          <p className="text-gray-600 text-base leading-relaxed">
            Identify missing skills and opportunities for improvement
          </p>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-blue-600 text-xl">📋</span>
              <h4 className="text-lg font-bold text-blue-800">Required Skills from Job Description</h4>
            </div>
            <div className="flex flex-wrap gap-3">
              {jdSkills.map((skill, index) => (
                <span 
                  key={index}
                  className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold border border-blue-200 hover:bg-blue-200 transition-colors duration-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {missingKeywords.length > 0 && (
            <div className="p-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200">
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-red-600 text-xl">⚠️</span>
                <h4 className="text-lg font-bold text-red-800">Missing Skills</h4>
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                {missingKeywords.map((keyword, index) => (
                  <span 
                    key={index}
                    className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-semibold border border-red-200"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="text-gray-700 text-base leading-relaxed">
                💡 Consider adding these skills to your resume or highlighting relevant experience.
              </p>
            </div>
          )}

          {missingKeywords.length === 0 && (
            <div className="p-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl text-center">
              <div className="text-green-600 text-4xl mb-4">✅</div>
              <h4 className="text-xl font-bold text-green-800 mb-3">Excellent Skills Coverage!</h4>
              <p className="text-green-700 text-base leading-relaxed">
                Your resume covers all the key skills mentioned in the job description.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-8 py-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">💡 Recommendations</h3>
          <p className="text-gray-600 text-base leading-relaxed">
            Actionable insights to improve your resume's effectiveness
          </p>
        </div>
        
        <div className="p-8 space-y-6">
          {coverage.map((bucket) => {
            if (bucket.percentage < 60) {
              return (
                <div key={bucket.category} className="flex items-start space-x-4 p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl">
                  <span className="text-yellow-500 text-2xl mt-1">⚠️</span>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-yellow-800 mb-2">{bucket.category} needs improvement</h4>
                    <p className="text-gray-700 text-base leading-relaxed">
                      Only {bucket.covered} of {bucket.total} items covered. 
                      Consider adding more relevant {bucket.category.toLowerCase()} to strengthen your application.
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })}

          {missingKeywords.length > 0 && (
            <div className="flex items-start space-x-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <span className="text-blue-500 text-2xl mt-1">💡</span>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-blue-800 mb-2">Add missing skills</h4>
                <p className="text-gray-700 text-base leading-relaxed">
                  Consider incorporating the missing skills into your experience descriptions 
                  or adding a dedicated skills section.
                </p>
              </div>
            </div>
          )}

          {coverage.every(bucket => bucket.percentage >= 80) && missingKeywords.length === 0 && (
            <div className="flex items-start space-x-4 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <span className="text-green-500 text-2xl mt-1">🎉</span>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-green-800 mb-2">Excellent coverage!</h4>
                <p className="text-gray-700 text-base leading-relaxed">
                  Your resume has strong alignment with the job requirements. 
                  Focus on optimizing the impact and relevance of your experience descriptions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
