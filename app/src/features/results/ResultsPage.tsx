import React, { useEffect, useState, Suspense, lazy, memo, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import * as Tooltip from '@radix-ui/react-tooltip';
import { GRAPHQL_URL } from '@/apollo';

// Lazy load heavy components for better initial page load
const FeedbackCard = lazy(() => import('@/components/FeedbackCard'));
const ScoreGauge = lazy(() => import('./components/ScoreGauge').then(m => ({ default: m.ScoreGauge })));
const KeywordHub = lazy(() => import('./components/KeywordHub').then(m => ({ default: m.KeywordHub })));
const ActionChecklist = lazy(() => import('./components/ActionChecklist').then(m => ({ default: m.ActionChecklist })));

interface SummaryData {
  pageCount: number;
  summary: string;
  title?: string;
  sections?: Array<{
    heading: string;
    level: number;
    start: number;
    end: number;
  }>;
  tables?: any[];
  lists?: any[];
  figures?: any;
  metadata?: {
    page_count: number | null;
    author: string | null;
    date: string | null;
  };
}

// Memoized loading component
const LoadingFallback = memo(() => (
  <div className="flex items-center justify-center py-8">
    <Loader className="h-6 w-6" />
  </div>
));

const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const [updatedResume, setUpdatedResume] = useState<any>(null);

  // Memoize mock data to prevent unnecessary re-renders
  const mockFeedback = useMemo(() => ({
    overallScore: 85,
    strengths: [
      'Strong technical skills in React and TypeScript',
      'Clear project descriptions with quantifiable achievements',
      'Good balance of frontend and full-stack experience',
    ],
    improvements: [
      {
        section: 'Experience',
        issue:
          'Lack of details on impact related to data processing and quality assurance pipelines',
        suggestion:
          'Include any experience related to data processing or quality assurance pipelines to better align with the job description',
        priority: 'high' as const,
      },
      {
        section: 'Skills',
        issue: 'Missing specific database management tools',
        suggestion:
          'Add experience with PostgreSQL, MongoDB, or other database systems mentioned in the job description',
        priority: 'medium' as const,
      },
    ],
    missingKeywords: [
      'Data processing',
      'Data quality assurance',
      'Digital data types',
      'Version control systems',
      'Python/R/SQL programming'
    ],
    jobMatchAnalysis:
      "Your resume shows strong alignment with the technical requirements for this position. The candidate demonstrates excellent frontend development skills and project management experience. However, there are opportunities to better highlight data processing experience and quality assurance methodologies to fully match the job requirements.",
    recommendations: [
      'Add specific examples of data processing projects you\'ve worked on',
      "Include any experience with automated testing or quality assurance processes",
      "Mention specific database management systems you've used"
    ]
  }), []);

  const mockKeywords = useMemo(() => ({
    missing: [
      'Data processing',
      'Data quality assurance',
      'Digital data types',
      'Version control systems',
      'Python/R/SQL programming'
    ],
    found: [
      'React',
      'TypeScript',
      'JavaScript',
      'Git',
      'CSS',
      'HTML',
      'Node.js',
      'API development'
    ]
  }), []);

  const mockActionItems = useMemo(() => [
    'Add specific data processing project to experience section',
    'Include database management tools in skills section',
    'Quantify impact in current role with specific metrics',
    "Add quality assurance methodologies you've used"
  ], []);

  useEffect(() => {
    // Check for resume analysis result first with freshness validation
    const updated = localStorage.getItem('resumeAnalysisResult');
    if (updated) {
      try {
        const parsedResult = JSON.parse(updated);
        
        // Check if result is fresh (less than 24 hours old)
        const isResultFresh = parsedResult.processedAt && 
          (Date.now() - parsedResult.processedAt) < 24 * 60 * 60 * 1000;
        
        if (isResultFresh || !parsedResult.processedAt) {
          // This is now an updated resume result, not a document
          setUpdatedResume(parsedResult);
          setLoading(false);
          
          // Add performance metrics if available
          if (parsedResult.processingTime) {
            console.log(`Resume was processed in ${parsedResult.processingTime}ms`);
          }
          return;
        } else {
          // Clear stale data
          localStorage.removeItem('resumeAnalysisResult');
          console.log('Cleared stale resume analysis data');
        }
      } catch (e) {
        console.error('Failed to parse cached resume analysis result:', e);
        localStorage.removeItem('resumeAnalysisResult');
        setError('Failed to load cached resume analysis result. Please try uploading again.');
        setLoading(false);
        return;
      }
    }

    // Check for resume analysis result
    const resumeResult = localStorage.getItem('resumeAnalysisResult');
    if (resumeResult) {
      try {
        const parsedResult = JSON.parse(resumeResult);
        console.log('Using cached resume analysis result:', parsedResult);
        setUpdatedResume(parsedResult);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse cached resume analysis result:', e);
        localStorage.removeItem('resumeAnalysisResult');
      }
    }

    // Also check for old extracted document format for backward compatibility
    const extractedDoc = localStorage.getItem('extractedDocument');
    if (extractedDoc) {
      try {
        const parsedDoc = JSON.parse(extractedDoc);
        setDoc(parsedDoc);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse cached document result:', e);
        localStorage.removeItem('extractedDocument');
      }
    }

    const fetchResults = async () => {
      try {
        const response = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query {
                documents {
                  id
                  filename
                  rawText
                  metadata
                  createdAt
                }
              }
            `,
          }),
        });

        const result = await response.json();
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        const documents = result.data.documents;
        if (documents && documents.length > 0) {
          const latestDoc = documents.sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
          setSummary(latestDoc.metadata);
          setDoc(latestDoc);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-12 w-12" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center p-6">
            <p className="body-text text-black mb-4">Error: {error}</p>
            <Button onClick={handleBack} className="mt-4">
              ← Back to Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (updatedResume) {
    const renderResumePreview = (resume: any) => {
      if (!resume || Object.keys(resume).length === 0) return null;
      const data =
        resume.updatedResumeJson || resume.resume || resume.updatedResume || resume;
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0)
        return null;
      if (data.professionalSummary || data.skills || data.experience || data.projects) {
        return (
          <div className="text-body">
            {data.professionalSummary && (
              <section className="mb-6">
                <h3 className="text-section-label mb-3">Professional Summary</h3>
                <p className="text-body">{data.professionalSummary}</p>
              </section>
            )}
            {data.skills && Array.isArray(data.skills) && data.skills.length > 0 && (
              <section className="mb-6">
                <h3 className="text-section-label mb-3">Skills</h3>
                <ul className="list-disc list-inside space-y-1">
                  {data.skills.map((skill: string, idx: number) => (
                    <li key={idx} className="text-body">
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.experience && Array.isArray(data.experience) && data.experience.length > 0 && (
              <section className="mb-6">
                <h3 className="text-section-label mb-3">Experience</h3>
                {data.experience.map((role: any, idx: number) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-gray-100 last:border-b-0">
                    <div className="text-body font-semibold">
                      {role.title} {role.company && `@ ${role.company}`}
                    </div>
                    {role.dates && <div className="text-muted">{role.dates}</div>}
                    {role.bullets && Array.isArray(role.bullets) && (
                      <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                        {role.bullets.map((bullet: string, bidx: number) => (
                          <li key={bidx} className="text-body">
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            )}
            {data.projects && Array.isArray(data.projects) && data.projects.length > 0 && (
              <section className="mb-6">
                <h3 className="text-section-label mb-3">Projects</h3>
                {data.projects.map((project: any, idx: number) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-gray-100 last:border-b-0">
                    <div className="text-body font-semibold">{project.name}</div>
                    {project.description && (
                      <div className="text-body mt-1">{project.description}</div>
                    )}
                    {project.technologies && Array.isArray(project.technologies) && (
                      <div className="text-muted mt-2">
                        Tech: {project.technologies.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        );
      }
      return (
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto body-text">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    };

    return (
      <div className="results-page">
        <nav className="results-page__nav">
          <div className="results-page__nav-content">
            <Link to="/">
              <h1 className="results-page__title">AI Resume Personalizer</h1>
            </Link>
          </div>
        </nav>

        <main className="results-page__main">
          <div className="results-page__container">
            <div className="results-page__content">
            <Suspense fallback={<LoadingFallback />}>
              <ScoreGauge score={mockFeedback.overallScore || 85} />
            </Suspense>

            <h2 className="text-heading-main">📄 Professional Resume Template</h2>

            <div className="card-container prominent" style={{background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '1px solid #93c5fd'}}>
              <div className="card-content-responsive">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-card-title">✨ Optimized Resume Ready</h3>
                    <p className="text-body mt-4">
                      Your resume has been enhanced with industry-specific keywords and improved
                      formatting to increase ATS compatibility and recruiter appeal.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-8 mt-8 justify-center items-center">
                    {updatedResume?.downloadUrl && (
                      <a
                        href={updatedResume.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-10 py-5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-all duration-300 font-bold shadow-xl hover:shadow-2xl text-center min-w-[320px] transform hover:scale-105 border-2 border-blue-600"
                        download
                      >
                        <span className="mr-3 text-2xl">📥</span>
                        Download Your Optimized Resume
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-container">
              <div className="card-header-responsive">
                <h3 className="text-card-title">Resume Preview</h3>
              </div>
              <div className="card-content-responsive">
                <div className="resume-preview">
                  {renderResumePreview(updatedResume)}
                </div>
              </div>
            </div>

            <h2 className="text-heading-main">📋 Resume Analysis & Feedback</h2>

            <Suspense fallback={<LoadingFallback />}>
              <KeywordHub missing={mockKeywords.missing} found={mockKeywords.found} />
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
              <FeedbackCard feedback={mockFeedback} />
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
              <ActionChecklist items={mockActionItems} />
            </Suspense>

            {updatedResume?.summary && (
              <div className="card-container">
                <div className="card-header-responsive">
                  <h3 className="text-card-title">📄 Summary of Changes</h3>
                </div>
                <div className="card-content-responsive">
                  <p className="text-body">{updatedResume.summary}</p>
                </div>
              </div>
            )}

            {updatedResume?.changes && Object.keys(updatedResume.changes).length > 0 && (
              <div className="card-container">
                <div className="card-header-responsive">
                  <h3 className="text-card-title">🔄 Detailed Changes</h3>
                </div>
                <div className="card-content-responsive">
                  <pre className="text-body bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                    {JSON.stringify(updatedResume.changes, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            </div>
          </div>
        </main>
      </div>
    );
  }
};

export default memo(ResultsPage);


