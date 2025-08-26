import React, { useEffect, useState, Suspense, lazy, memo, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import * as Tooltip from '@radix-ui/react-tooltip';
import { GRAPHQL_URL } from '@/apollo';
import { useMutation, gql } from '@apollo/client';

// Lazy load heavy components for better initial page load
const FeedbackCard = lazy(() => import('@/components/FeedbackCard'));
const ScoreGauge = lazy(() => import('./components/ScoreGauge').then(m => ({ default: m.ScoreGauge })));
const KeywordHub = lazy(() => import('./components/KeywordHub').then(m => ({ default: m.KeywordHub })));
const ActionChecklist = lazy(() => import('./components/ActionChecklist').then(m => ({ default: m.ActionChecklist })));

// Lazy load studio components
const RoleDecisionPanel = lazy(() => import('../studio/components/RoleDecisionPanel').then(m => ({ default: m.RoleDecisionPanel })));
const ProjectDecisionPanel = lazy(() => import('../studio/components/ProjectDecisionPanel').then(m => ({ default: m.ProjectDecisionPanel })));
const CoverageAnalysis = lazy(() => import('../studio/components/CoverageAnalysis').then(m => ({ default: m.CoverageAnalysis })));
const EnhancedInteractiveStudio = lazy(() => import('./components/EnhancedInteractiveStudio').then(m => ({ default: m.EnhancedInteractiveStudio })));

// GraphQL mutations
const CREATE_OPTIMIZATION_PLAN = gql`
  mutation CreateOptimizationPlan($resume: Upload!, $jobDescription: String!, $companyName: String) {
    createOptimizationPlan(resume: $resume, jobDescription: $jobDescription, companyName: $companyName) {
      plan {
        id
        roles {
          id
          company
          position
          duration
          location
          bullets {
            id
            text
            jdMatchScore
            impactScore
            suggested
          }
          jdMatchScore
          impactScore
        }
        projects {
          id
          projectName
          techStack
          bullets {
            id
            text
            jdMatchScore
            impactScore
            suggested
          }
          jdMatchScore
        }
        coverage {
          category
          covered
          total
          percentage
        }
      }
      fit {
        overallScore
        experienceMatch
        projectMatch
        skillCoverage
        missingKeywords
      }
    }
  }
`;

const APPLY_DECISIONS = gql`
  mutation ApplyDecisions($planId: String!, $roleDecisions: [RoleDecisionInput!]!, $projectDecisions: [ProjectDecisionInput!]!) {
    applyDecisions(planId: $planId, roleDecisions: $roleDecisions, projectDecisions: $projectDecisions) {
      success
      downloadUrl
      changes
    }
  }
`;

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

// ResultsCard component for consistent styling
function ResultsCard({ 
  id, 
  title, 
  subtitle, 
  gradient, 
  children 
}: { 
  id: string; 
  title: string; 
  subtitle?: string; 
  gradient: string; 
  children: React.ReactNode; 
}) {
  return (
    <section aria-labelledby={id} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className={`rounded-2xl border shadow-sm ${gradient}`}>
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200">
          <h3 id={id} className="text-lg sm:text-xl font-semibold text-black">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-black mt-2">
              {subtitle}
            </p>
          )}
        </div>
        <div className="px-5 pb-6 sm:px-6 text-black">
          {children}
        </div>
      </div>
    </section>
  );
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

  // Studio state
  const [showStudio, setShowStudio] = useState(false);
  const [studioPlan, setStudioPlan] = useState<any>(null);
  const [studioFit, setStudioFit] = useState<any>(null);
  const [studioPlanId, setStudioPlanId] = useState<string | null>(null);
  const [roleDecisions, setRoleDecisions] = useState<Record<string, any>>({});
  const [projectDecisions, setProjectDecisions] = useState<Record<string, any>>({});
  const [editedBullets, setEditedBullets] = useState<Record<string, Record<string, string>>>({});
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  // GraphQL mutations
  const [createPlan] = useMutation(CREATE_OPTIMIZATION_PLAN);
  const [applyDecisions] = useMutation(APPLY_DECISIONS);

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
      'Node.js',
      'Git',
      'API development',
      'Frontend development',
      'Full-stack development'
    ]
  }), []);

  // Studio functions
  const handleCreateStudioPlan = async () => {
    console.log('🔍 Interactive Studio Debug:', {
      hasUpdatedResume: !!updatedResume,
      hasOriginalFileData: !!updatedResume?.originalFileData,
      hasJobDescription: !!updatedResume?.jobDescription,
      updatedResumeKeys: updatedResume ? Object.keys(updatedResume) : [],
      originalFileDataLength: updatedResume?.originalFileData?.length || 0,
      jobDescriptionLength: updatedResume?.jobDescription?.length || 0
    });

    if (!updatedResume?.originalFileData || !updatedResume?.jobDescription) {
      setStudioError('Missing resume file or job description');
      return;
    }

    setStudioLoading(true);
    setStudioError(null);

    try {
      // Convert base64 data back to File object
      const base64ToFile = (base64Data: string, fileName: string, fileType: string): File => {
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new File([byteArray], fileName, { type: fileType });
      };

      // Extract company name from job description
      const extractCompanyName = (jobDescription: string): string => {
        // Common patterns for company names in job descriptions
        const patterns = [
          /at\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+in|\s+is|\s+we|\s+our|$)/i,
          /([A-Z][a-zA-Z\s&.,]+?)\s+is\s+looking/i,
          /([A-Z][a-zA-Z\s&.,]+?)\s+seeks/i,
          /([A-Z][a-zA-Z\s&.,]+?)\s+hiring/i,
          /join\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+as|\s+to|\s+in|$)/i
        ];
        
        for (const pattern of patterns) {
          const match = jobDescription.match(pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        
        // Fallback: look for common company indicators
        const companyIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'Company', 'Technologies', 'Solutions', 'Systems'];
        const words = jobDescription.split(/\s+/);
        
        for (let i = 0; i < words.length - 1; i++) {
          if (companyIndicators.some(indicator => 
            words[i + 1]?.includes(indicator) || words[i]?.includes(indicator)
          )) {
            return `${words[i]} ${words[i + 1]}`.trim();
          }
        }
        
        return 'Unknown Company';
      };

      const resumeFile = base64ToFile(
        updatedResume.originalFileData,
        updatedResume.originalFileName || 'resume.pdf',
        updatedResume.originalFileType || 'application/pdf'
      );

      const companyName = extractCompanyName(updatedResume.jobDescription);

      const result = await createPlan({
        variables: {
          resume: resumeFile,
          jobDescription: updatedResume.jobDescription,
          companyName
        }
      });

      if (result.data?.createOptimizationPlan) {
        setStudioPlan(result.data.createOptimizationPlan.plan);
        setStudioFit(result.data.createOptimizationPlan.fit);
        setStudioPlanId(result.data.createOptimizationPlan.plan.id);
        setShowStudio(true);
      }
    } catch (err) {
      console.error('Error creating studio plan:', err);
      setStudioError(err instanceof Error ? err.message : 'Failed to create optimization plan');
    } finally {
      setStudioLoading(false);
    }
  };

  const handleApplyDecisions = async () => {
    if (!studioPlanId) {
      setStudioError('No optimization plan found');
      return;
    }

    setStudioLoading(true);
    setStudioError(null);

    try {
      const roleDecisionsArray = Object.values(roleDecisions);
      const projectDecisionsArray = Object.values(projectDecisions);

      const result = await applyDecisions({
        variables: {
          planId: studioPlanId,
          roleDecisions: roleDecisionsArray,
          projectDecisions: projectDecisionsArray
        }
      });

      if (result.data?.applyDecisions?.success) {
        // Update the resume with the new optimized version
        setUpdatedResume((prev: any) => ({
          ...prev,
          downloadUrl: result.data.applyDecisions.downloadUrl,
          changes: result.data.applyDecisions.changes
        }));
        setShowStudio(false);
      }
    } catch (err) {
      console.error('Error applying decisions:', err);
      setStudioError(err instanceof Error ? err.message : 'Failed to apply decisions');
    } finally {
      setStudioLoading(false);
    }
  };

  // Enhanced feedback generation with 7-dimensional scoring
  const generateFeedback = useMemo(() => {
    if (!updatedResume?.updatedResumeJson) {
      console.log('Using mock feedback - no updatedResume data');
      return mockFeedback;
    }
    
    console.log('Generating feedback with data:', updatedResume.updatedResumeJson);

    const data = updatedResume.updatedResumeJson;
    const jobDescription = updatedResume.jobDescription || '';

    // Extract skills from job description
    const extractSkillsFromJD = (jd: string): string[] => {
      const skillPatterns = [
        /(?:experience with|proficient in|knowledge of|familiar with)\s+([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi,
        /([A-Za-z0-9\s]+)\s+(?:framework|library|tool|technology|language)/gi
      ];
      
      const skills = new Set<string>();
      
      skillPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(jd)) !== null) {
          const skill = match[1]?.trim();
          if (skill && skill.length > 2) {
            skills.add(skill.toLowerCase());
          }
        }
      });
      
      return Array.from(skills);
    };

    // Extract industry keywords
    const extractIndustryKeywords = (jd: string): string[] => {
      const industryTerms = [
        'agile', 'scrum', 'kanban', 'ci/cd', 'devops', 'microservices',
        'cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
        'machine learning', 'ai', 'data science', 'analytics',
        'saas', 'b2b', 'b2c', 'e-commerce', 'fintech', 'healthtech'
      ];
      
      return industryTerms.filter(term => 
        jd.toLowerCase().includes(term.toLowerCase())
      );
    };

    const jdSkills = extractSkillsFromJD(jobDescription);
    const industryKeywords = extractIndustryKeywords(jobDescription);
    const resumeSkills = Array.isArray(data.skills) ? data.skills : 
                        typeof data.skills === 'object' ? Object.values(data.skills).flat() : [];

    // Calculate enhanced scores
    const experienceYears = data.experience?.length || 0;
    const projectCount = data.projects?.length || 0;
    const skillMatchCount = jdSkills.filter(skill => 
      resumeSkills.some((resumeSkill: any) => 
        resumeSkill.toLowerCase().includes(skill.toLowerCase())
      )
    ).length;

    // 7-dimensional professional scoring framework
    const baselineScreening = Math.min(100, (skillMatchCount / Math.max(1, jdSkills.length)) * 100);
    const experienceQuality = Math.min(100, (experienceYears / 5) * 100);
    const projectDepth = Math.min(100, (projectCount / 3) * 100);
    const skillsFit = Math.min(100, (resumeSkills.length / 20) * 100);
    const impactMetrics = data.experience?.some((exp: any) => 
      exp.impactBullets?.some((bullet: any) => 
        bullet.toLowerCase().includes('%') || 
        bullet.toLowerCase().includes('increase') ||
        bullet.toLowerCase().includes('improve')
      )
    ) ? 85 : 60;
    const leadershipDifferentiation = data.experience?.some((exp: any) => 
      exp.impactBullets?.some((bullet: any) => 
        bullet.toLowerCase().includes('lead') ||
        bullet.toLowerCase().includes('manage') ||
        bullet.toLowerCase().includes('mentor')
      )
    ) ? 80 : 50;
    const cultureMissionFit = 75; // Default score

    const overallScore = Math.round(
      (baselineScreening * 0.25) +
      (experienceQuality * 0.20) +
      (projectDepth * 0.15) +
      (skillsFit * 0.15) +
      (impactMetrics * 0.10) +
      (leadershipDifferentiation * 0.10) +
      (cultureMissionFit * 0.05)
    );

    // Enhanced strengths and improvements
    const strengths = [];
    const improvements = [];

    if (baselineScreening >= 80) {
      strengths.push('Excellent skill alignment with job requirements');
    } else {
      improvements.push({
        section: 'Skills',
        issue: 'Skills could better match the job requirements',
        suggestion: 'Add more relevant technical skills from the job description',
        priority: 'high' as const
      });
    }

    if (experienceQuality >= 80) {
      strengths.push('Strong professional experience level');
    } else {
      improvements.push({
        section: 'Experience',
        issue: 'Experience level may not fully match job requirements',
        suggestion: 'Highlight relevant experience and quantify achievements',
        priority: 'medium' as const
      });
    }

    if (impactMetrics >= 80) {
      strengths.push('Strong quantifiable achievements demonstrated');
    } else {
      improvements.push({
        section: 'Achievements',
        issue: 'Lack of quantifiable impact metrics',
        suggestion: 'Add specific numbers, percentages, and measurable outcomes',
        priority: 'high' as const
      });
    }

    return {
      overallScore,
      strengths,
      improvements,
      missingKeywords: jdSkills.filter(skill => 
        !resumeSkills.some((resumeSkill: any) => 
          resumeSkill.toLowerCase().includes(skill.toLowerCase())
        )
      ),
      jobMatchAnalysis: `Your resume demonstrates ${overallScore >= 85 ? 'excellent' : overallScore >= 75 ? 'strong' : overallScore >= 65 ? 'good' : 'moderate'} alignment with the job requirements. The analysis shows strong technical skills and relevant experience, with opportunities for enhancement in specific areas.`,
      jobMatchAnalysisDetailed: {
        summary: `Comprehensive analysis shows ${overallScore}% overall match with detailed breakdown across 7 key dimensions.`,
        scoringBreakdown: {
          baselineScreening,
          experienceQuality,
          projectDepth,
          skillsFit,
          impactMetrics,
          leadershipDifferentiation,
          cultureMissionFit
        },
        detailedAnalysis: [
          `Skill alignment: ${baselineScreening}% - ${baselineScreening >= 80 ? 'Excellent' : baselineScreening >= 60 ? 'Good' : 'Needs improvement'} match with required technical skills`,
          `Experience quality: ${experienceQuality}% - ${experienceQuality >= 80 ? 'Strong' : experienceQuality >= 60 ? 'Adequate' : 'Limited'} professional experience`,
          `Project depth: ${projectDepth}% - ${projectDepth >= 80 ? 'Comprehensive' : projectDepth >= 60 ? 'Good' : 'Basic'} project portfolio`,
          `Skills fit: ${skillsFit}% - ${skillsFit >= 80 ? 'Excellent' : skillsFit >= 60 ? 'Good' : 'Limited'} technical skill diversity`,
          `Impact metrics: ${impactMetrics}% - ${impactMetrics >= 80 ? 'Strong' : impactMetrics >= 60 ? 'Moderate' : 'Limited'} quantifiable achievements`,
          `Leadership: ${leadershipDifferentiation}% - ${leadershipDifferentiation >= 80 ? 'Strong' : leadershipDifferentiation >= 60 ? 'Moderate' : 'Limited'} leadership experience`,
          `Culture fit: ${cultureMissionFit}% - Good alignment with company values and mission`
        ]
      },
      recommendations: [
        'Enhance skill descriptions with specific technologies and methodologies',
        'Add quantifiable achievements with metrics and percentages',
        'Highlight leadership and cross-functional collaboration experience',
        'Include relevant certifications and professional development'
      ]
    };
  }, [updatedResume]);

  // Enhanced keywords generation
  const generateKeywords = useMemo(() => {
    console.log('🔍 Keywords Analysis Debug:', {
      hasUpdatedResume: !!updatedResume,
      hasUpdatedResumeJson: !!updatedResume?.updatedResumeJson,
      hasMissingKeywords: !!updatedResume?.missingKeywords,
      updatedResumeKeys: updatedResume ? Object.keys(updatedResume) : [],
      updatedResumeJsonKeys: updatedResume?.updatedResumeJson ? Object.keys(updatedResume.updatedResumeJson) : []
    });

    // Use backend missing keywords if available
    if (updatedResume?.missingKeywords && Array.isArray(updatedResume.missingKeywords)) {
      console.log('Using backend missing keywords:', updatedResume.missingKeywords);
      
      // Extract found keywords from resume data
      const data = updatedResume.updatedResumeJson;
      const jobDescription = updatedResume.jobDescription || '';
      
      const extractKeywords = (text: string): string[] => {
        const keywords = new Set<string>();
        
        // Technical skills patterns - expanded list
        const techPatterns = [
          /(?:React|Angular|Vue|Node\.js|Python|Java|JavaScript|TypeScript|SQL|MongoDB|AWS|Docker|Kubernetes)/gi,
          /(?:HTML|CSS|Git|REST|API|GraphQL|Redux|Vuex|Express|Django|Flask|Spring)/gi,
          /(?:PostgreSQL|MySQL|Redis|Elasticsearch|MongoDB|Firebase)/gi,
          /(?:Docker|Kubernetes|Jenkins|CI\/CD|DevOps|Microservices)/gi,
          /(?:Machine Learning|AI|Data Science|Analytics|Big Data)/gi,
          /(?:Agile|Scrum|Kanban|Project Management|Leadership)/gi
        ];
        
        // Extract from tech patterns
        techPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            keywords.add(match[0].toLowerCase());
          }
        });
        
        // Extract common job requirement keywords
        const requirementPatterns = [
          /(?:experience with|proficient in|knowledge of|familiar with|expertise in)\s+([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi,
          /(?:required|preferred|must have|should have)\s+([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi,
          /(?:skills|technologies|tools|frameworks|languages)\s*:\s*([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi
        ];
        
        requirementPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            if (match[1]) {
              const skills = match[1].split(',').map(s => s.trim().toLowerCase());
              skills.forEach(skill => {
                if (skill.length > 2 && skill.length < 30) {
                  keywords.add(skill);
                }
              });
            }
          }
        });
        
        // Also extract from skills section if available (for resume data)
        if (data.skills) {
          const skillsText = typeof data.skills === 'object' 
            ? JSON.stringify(data.skills) 
            : String(data.skills);
          
          // Extract individual skills
          const skillWords = skillsText.match(/[A-Za-z0-9\s]+/g) || [];
          skillWords.forEach(word => {
            const cleanWord = word.trim().toLowerCase();
            if (cleanWord.length > 2 && cleanWord.length < 20) {
              keywords.add(cleanWord);
            }
          });
        }
        
        console.log('🔍 Extracted keywords from text:', Array.from(keywords));
        return Array.from(keywords);
      };

      const jdKeywords = extractKeywords(jobDescription);
      const resumeKeywords = extractKeywords(JSON.stringify(data));
      
      const found = jdKeywords.filter(keyword => 
        resumeKeywords.includes(keyword.toLowerCase())
      );
      
      return {
        found,
        missing: updatedResume.missingKeywords
      };
    }

    if (!updatedResume?.updatedResumeJson) {
      console.log('Using mock keywords - no updatedResume data');
      return mockKeywords;
    }

    const data = updatedResume.updatedResumeJson;
    const jobDescription = updatedResume.jobDescription || '';
    
    console.log('Generating keywords with data:', { data, jobDescription });

    const extractKeywords = (text: string): string[] => {
      const keywords = new Set<string>();
      
      // Technical skills patterns - expanded list
      const techPatterns = [
        /(?:React|Angular|Vue|Node\.js|Python|Java|JavaScript|TypeScript|SQL|MongoDB|AWS|Docker|Kubernetes)/gi,
        /(?:HTML|CSS|Git|REST|API|GraphQL|Redux|Vuex|Express|Django|Flask|Spring)/gi,
        /(?:PostgreSQL|MySQL|Redis|Elasticsearch|MongoDB|Firebase)/gi,
        /(?:Docker|Kubernetes|Jenkins|CI\/CD|DevOps|Microservices)/gi,
        /(?:Machine Learning|AI|Data Science|Analytics|Big Data)/gi,
        /(?:Agile|Scrum|Kanban|Project Management|Leadership)/gi
      ];
      
      // Extract from tech patterns
      techPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          keywords.add(match[0].toLowerCase());
        }
      });
      
      // Extract common job requirement keywords
      const requirementPatterns = [
        /(?:experience with|proficient in|knowledge of|familiar with|expertise in)\s+([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi,
        /(?:required|preferred|must have|should have)\s+([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi,
        /(?:skills|technologies|tools|frameworks|languages)\s*:\s*([A-Za-z0-9\s,]+?)(?:\s|\.|,|$)/gi
      ];
      
      requirementPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (match[1]) {
            const skills = match[1].split(',').map(s => s.trim().toLowerCase());
            skills.forEach(skill => {
              if (skill.length > 2 && skill.length < 30) {
                keywords.add(skill);
              }
            });
          }
        }
      });
      
      // Also extract from skills section if available (for resume data)
      if (data.skills) {
        const skillsText = typeof data.skills === 'object' 
          ? JSON.stringify(data.skills) 
          : String(data.skills);
        
        // Extract individual skills
        const skillWords = skillsText.match(/[A-Za-z0-9\s]+/g) || [];
        skillWords.forEach(word => {
          const cleanWord = word.trim().toLowerCase();
          if (cleanWord.length > 2 && cleanWord.length < 20) {
            keywords.add(cleanWord);
          }
        });
      }
      
      console.log('🔍 Extracted keywords from text:', Array.from(keywords));
      return Array.from(keywords);
    };

    const jdKeywords = extractKeywords(jobDescription);
    const resumeKeywords = extractKeywords(JSON.stringify(data));
    
    console.log('🔍 Keyword Analysis:', {
      jdKeywords: jdKeywords,
      resumeKeywords: resumeKeywords,
      jdKeywordsCount: jdKeywords.length,
      resumeKeywordsCount: resumeKeywords.length
    });
    
    const result = {
      found: jdKeywords.filter(keyword => 
        resumeKeywords.includes(keyword.toLowerCase())
      ),
      missing: jdKeywords.filter(keyword => 
        !resumeKeywords.includes(keyword.toLowerCase())
      )
    };
    
    console.log('🔍 Final keyword result:', {
      found: result.found,
      missing: result.missing,
      foundCount: result.found.length,
      missingCount: result.missing.length
    });
    
    return result;
  }, [updatedResume]);

  // Enhanced action items generation
  const generateActionItems = useMemo(() => {
    const items = [
      'Review and enhance skill descriptions with specific technologies',
      'Add quantifiable achievements with metrics and percentages',
      'Highlight leadership and cross-functional collaboration experience',
      'Include relevant certifications and professional development',
      'Optimize resume formatting for ATS compatibility',
      'Add industry-specific keywords from the job description'
    ];

    if (generateKeywords.missing.length > 0) {
      items.push(`Add missing keywords: ${generateKeywords.missing.slice(0, 3).join(', ')}`);
    }

    return items;
  }, [generateKeywords]);

  // Resume preview renderer
  const renderResumePreview = (data: any) => {
    console.log('🔍 Resume Preview Debug:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      dataType: typeof data,
      isArray: Array.isArray(data)
    });
    
    if (!data) return <div className="text-black">No resume data available</div>;

    return (
      <div className="text-black">
        {/* Contact Information */}
        {data.contactInfo && (
          <section className="mb-6">
            <h3 className="text-black font-semibold mb-3">Contact Information</h3>
            <div className="space-y-1">
              {data.contactInfo.name && <p className="text-black font-semibold">{data.contactInfo.name}</p>}
              {data.contactInfo.email && <p className="text-black">{data.contactInfo.email}</p>}
              {data.contactInfo.phone && <p className="text-black">{data.contactInfo.phone}</p>}
              {data.contactInfo.linkedin && <p className="text-black">{data.contactInfo.linkedin}</p>}
              {data.contactInfo.github && <p className="text-black">{data.contactInfo.github}</p>}
            </div>
          </section>
        )}

        {/* Education */}
        {data.education && Array.isArray(data.education) && data.education.length > 0 && (
          <section className="mb-6">
            <h3 className="text-slate-900 font-semibold mb-3">Education</h3>
            {data.education.map((edu: any, idx: number) => (
              <div key={idx} className="mb-4 pb-4 border-b border-slate-200 last:border-b-0">
                <div className="text-slate-900 font-semibold">
                  {edu.degree} {edu.institution && `@ ${edu.institution}`}
                </div>
                {edu.year && <div className="text-slate-600">{edu.year}</div>}
                {edu.gpa && <div className="text-slate-600">GPA: {edu.gpa}</div>}
              </div>
            ))}
          </section>
        )}

        {/* Experience */}
        {data.experience && Array.isArray(data.experience) && data.experience.length > 0 && (
          <section className="mb-6">
            <h3 className="text-slate-900 font-semibold mb-3">Experience</h3>
            {data.experience.map((role: any, idx: number) => (
              <div key={idx} className="mb-4 pb-4 border-b border-slate-200 last:border-b-0">
                <div className="text-slate-900 font-semibold">
                  {role.position} {role.company && `@ ${role.company}`}
                </div>
                {role.duration && <div className="text-slate-600">{role.duration}</div>}
                {role.location && <div className="text-slate-600">{role.location}</div>}
                {role.impactBullets && Array.isArray(role.impactBullets) && (
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    {role.impactBullets.map((bullet: string, bidx: number) => (
                      <li key={bidx} className="text-slate-800 leading-relaxed">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Projects */}
        {data.projects && Array.isArray(data.projects) && data.projects.length > 0 && (
          <section className="mb-6">
            <h3 className="text-slate-900 font-semibold mb-3">Projects</h3>
            {data.projects.map((project: any, idx: number) => (
              <div key={idx} className="mb-4 pb-4 border-b border-slate-200 last:border-b-0">
                <div className="text-slate-900 font-semibold">{project.projectName}</div>
                {project.techStack && (
                  <div className="text-slate-600 mt-1">Tech: {project.techStack}</div>
                )}
                {project.impactBullets && Array.isArray(project.impactBullets) && (
                  <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                    {project.impactBullets.map((bullet: string, bidx: number) => (
                      <li key={bidx} className="text-slate-800 leading-relaxed">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Skills */}
        {data.skills && (
          <section className="mb-6">
            <h3 className="text-slate-900 font-semibold mb-3">Skills</h3>
            {typeof data.skills === 'object' && !Array.isArray(data.skills) ? (
              Object.entries(data.skills).map(([category, skillsList]) => (
                <div key={category} className="mb-3">
                  <div className="text-slate-900 font-semibold">{category}:</div>
                  {Array.isArray(skillsList) && (
                    <div className="text-slate-800 ml-4 leading-relaxed">{skillsList.join(', ')}</div>
                  )}
                </div>
              ))
            ) : Array.isArray(data.skills) ? (
              <div className="text-slate-800 leading-relaxed">{data.skills.join(', ')}</div>
            ) : (
              <div className="text-slate-800 leading-relaxed">{String(data.skills)}</div>
            )}
          </section>
        )}

        {/* Honors & Awards */}
        {data.honorsAndAwards && Array.isArray(data.honorsAndAwards) && data.honorsAndAwards.length > 0 && (
          <section className="mb-6">
            <h3 className="text-slate-900 font-semibold mb-3">Honors & Awards</h3>
            <ul className="list-disc list-inside space-y-1">
              {data.honorsAndAwards.map((award: string, idx: number) => (
                <li key={idx} className="text-slate-800 leading-relaxed">{award}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  };

  useEffect(() => {
    // Check for cached resume analysis result
    const cachedResult = localStorage.getItem('resumeAnalysisResult');
    if (cachedResult) {
      try {
        const parsedResult = JSON.parse(cachedResult);
        console.log('Using cached resume analysis result:', parsedResult);
        setUpdatedResume(parsedResult);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse cached resume analysis result:', e);
        localStorage.removeItem('resumeAnalysisResult');
      }
    }

    // Check for old extracted document format for backward compatibility
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
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    );
  }

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
                        <div className="card-container">
              <div className="card-header-responsive">
                <h3 className="text-card-title">Enhanced Match Score</h3>
                <p className="text-muted mt-2">AI-powered analysis of your resume alignment</p>
              </div>
              <div className="card-content-responsive">
            <Suspense fallback={<LoadingFallback />}>
                  <ScoreGauge score={generateFeedback.overallScore} />
            </Suspense>
              </div>
            </div>

            <h2 className="text-heading-main">📄 Professional Resume Template</h2>

            <div className="card-container">
              <div className="card-header-responsive">
                    <h3 className="text-card-title">✨ Optimized Resume Ready</h3>
                <p className="text-muted mt-2">
                      Your resume has been enhanced with industry-specific keywords and improved
                      formatting to increase ATS compatibility and recruiter appeal.
                    </p>
                  </div>
              <div className="card-content-responsive">
                <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
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

            <div className="card-container">
              <div className="card-header-responsive">
                <h3 className="text-card-title">Resume Preview</h3>
              </div>
              <div className="card-content-responsive">
                <div className="resume-preview">
                  {renderResumePreview(updatedResume?.updatedResumeJson)}
                </div>
              </div>
            </div>

            <Suspense fallback={<LoadingFallback />}>
              <KeywordHub missing={generateKeywords.missing} found={generateKeywords.found} />
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
              <FeedbackCard feedback={generateFeedback} />
            </Suspense>

            <div className="card-container">
              <div className="card-content-responsive">
            <Suspense fallback={<LoadingFallback />}>
                  <ActionChecklist items={generateActionItems} />
            </Suspense>
              </div>
            </div>

            {updatedResume?.changes && (
              <div className="card-container">
                <div className="card-header-responsive">
                  <h3 className="text-card-title">🔄 AI Optimization Summary</h3>
                </div>
                <div className="card-content-responsive">
                  <p className="text-slate-800 leading-relaxed">{updatedResume.changes}</p>
                </div>
              </div>
            )}

            {updatedResume?.processingTime && (
              <div className="card-container">
                <div className="card-header-responsive">
                  <h3 className="text-card-title">⚡ Processing Information</h3>
                </div>
                <div className="card-content-responsive">
                  <p className="text-slate-800 leading-relaxed">
                    Your resume was processed in {updatedResume.processingTime}ms using advanced AI optimization.
                  </p>
                </div>
              </div>
            )}

            {/* Interactive Studio Section */}
            <div className="card-container">
              <div className="card-header-responsive">
                <h3 className="text-card-title">🎯 Interactive Resume Studio</h3>
              </div>
              <div className="card-content-responsive">
                {!showStudio ? (
                <div className="text-center py-8">
                  <h3 className="text-slate-900 font-semibold text-lg">✨ Take Control of Your Resume</h3>
                  <p className="text-slate-800 mt-4 leading-relaxed">
                    Use our advanced Interactive Studio to fine-tune your resume with AI-powered suggestions.
                    Make decisions on which experiences to highlight, condense, or remove based on real-time analysis.
                  </p>
                  <ul className="text-slate-800 mt-4 space-y-2 list-disc list-inside leading-relaxed">
                    <li>AI-powered bullet point suggestions</li>
                    <li>Real-time JD match scoring</li>
                    <li>Impact optimization recommendations</li>
                    <li>Professional formatting guidance</li>
                  </ul>
                  <Button
                    onClick={handleCreateStudioPlan}
                    disabled={studioLoading}
                    className="mt-6 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {studioLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Creating Studio Plan...
                      </>
                    ) : (
                      '🚀 Launch Interactive Studio'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">


                  {/* Studio Error */}
                  {studioError && (
                    <ResultsCard
                      id="studio-error-card"
                      title="⚠️ Studio Error"
                      gradient="bg-gradient-to-br from-red-50 to-pink-100 border-red-200"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-red-600 text-xl">⚠️</span>
                        <div className="text-red-800 font-semibold">{studioError}</div>
                      </div>
                    </ResultsCard>
                  )}

                  {/* Enhanced Interactive Studio */}
                  {studioPlan && (
                    <Suspense fallback={<LoadingFallback />}>
                      <EnhancedInteractiveStudio
                        planId={studioPlanId || ''}
                        originalResumeJson={updatedResume?.updatedResumeJson}
                        jobDescription={updatedResume?.jobDescription || ''}
                        onResumeUpdate={(updatedResume) => {
                          console.log('Resume updated:', updatedResume);
                          // Update the resume data
                          setUpdatedResume((prev: any) => ({
                            ...prev,
                            updatedResumeJson: updatedResume
                          }));
                        }}
                        onScoresUpdate={(scores) => {
                          console.log('Scores updated:', scores);
                          // Update the scores
                          setStudioFit(scores);
                        }}
                      />
                    </Suspense>
                  )}

                  {/* Apply Decisions Button */}
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={handleApplyDecisions}
                      disabled={studioLoading}
                      className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      {studioLoading ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Applying Changes...
                        </>
                      ) : (
                        '✅ Apply All Changes'
                      )}
                    </Button>
                </div>
              </div>
            )}
            </div>
            </div>
          </div>
        </main>
      </div>
    );
};

export default ResultsPage;


