import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { RoleDecisionPanel } from './components/RoleDecisionPanel';
import { ProjectDecisionPanel } from './components/ProjectDecisionPanel';
import { CoverageAnalysis } from './components/CoverageAnalysis';

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
          jdMatchScore
          impactScore
          bullets {
            id
            text
            jdMatchScore
            impactScore
            suggested
          }
        }
        projects {
          id
          projectName
          techStack
          jdMatchScore
          bullets {
            id
            text
            jdMatchScore
            impactScore
            suggested
          }
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
  mutation ApplyDecisions(
    $planId: ID!
    $roleDecisions: [RoleDecisionInput!]!
    $projectDecisions: [ProjectDecisionInput!]!
    $jdText: String!
  ) {
    applyDecisions(
      planId: $planId
      roleDecisions: $roleDecisions
      projectDecisions: $projectDecisions
      jdText: $jdText
    ) {
      updatedResumeJson
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

interface RoleDecision {
  roleId: string;
  action: 'KEEP' | 'CONDENSE' | 'HIDE';
  selectedBullets: string[];
}

interface ProjectDecision {
  projectId: string;
  action: 'KEEP' | 'CONDENSE' | 'HIDE';
  selectedBullets: string[];
}

export function StudioPage() {
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [fit, setFit] = useState<any>(null);
  const [roleDecisions, setRoleDecisions] = useState<Record<string, RoleDecision>>({});
  const [projectDecisions, setProjectDecisions] = useState<Record<string, ProjectDecision>>({});
  const [jobDescription, setJobDescription] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedBullets, setEditedBullets] = useState<Record<string, Record<string, string>>>({});
  
  const [createPlan] = useMutation(CREATE_OPTIMIZATION_PLAN);
  const [applyDecisions] = useMutation(APPLY_DECISIONS);
  
  // Load planId from localStorage on mount
  useEffect(() => {
    const savedPlanId = localStorage.getItem('planId');
    if (savedPlanId) {
      setPlanId(savedPlanId);
      // TODO: Rehydrate plan from server or show expired message
    }
  }, []);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid PDF file.');
    }
  };
  
  const handleCreatePlan = async () => {
    if (!file || !jobDescription.trim()) {
      setError('Please select a PDF file and provide a job description.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Extract company name from job description
      const extractCompanyName = (jobDescription: string): string => {
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

      const companyName = extractCompanyName(jobDescription.trim());

      const result = await createPlan({
        variables: { 
          resume: file, 
          jobDescription: jobDescription.trim(),
          companyName
        }
      });
      
      const { plan: newPlan, fit: newFit } = result.data.createOptimizationPlan;
      setPlan(newPlan);
      setFit(newFit);
      setPlanId(newPlan.id);
      localStorage.setItem('planId', newPlan.id);
      
      console.log('✅ Plan created successfully:', {
        planId: newPlan.id,
        rolesCount: newPlan.roles.length,
        projectsCount: newPlan.projects.length,
        overallScore: newFit.overallScore
      });
    } catch (err) {
      console.error('❌ Failed to create plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to create optimization plan');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApplyDecisions = async () => {
    if (!planId) {
      setError('No plan found. Please create a plan first.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const roleDecisionsArray = Object.values(roleDecisions);
      const projectDecisionsArray = Object.values(projectDecisions);
      
      const result = await applyDecisions({
        variables: {
          planId,
          roleDecisions: roleDecisionsArray,
          projectDecisions: projectDecisionsArray,
          jdText: jobDescription
        }
      });
      
      // Update fit metrics
      setFit(result.data.applyDecisions.fit);
      
      // Store the updated resume
      const updatedResume = {
        ...result.data.applyDecisions,
        processedAt: Date.now(),
        processingTime: 0
      };
      localStorage.setItem('resumeAnalysisResult', JSON.stringify(updatedResume));
      
      console.log('✅ Decisions applied successfully:', {
        roleDecisionsCount: roleDecisionsArray.length,
        projectDecisionsCount: projectDecisionsArray.length,
        newOverallScore: result.data.applyDecisions.fit.overallScore
      });
      
      // Navigate to results page
      navigate('/results');
    } catch (err) {
      console.error('❌ Failed to apply decisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply decisions');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRoleDecision = (roleId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE', selectedBullets: string[] = []) => {
    setRoleDecisions(prev => ({
      ...prev,
      [roleId]: { roleId, action, selectedBullets }
    }));
  };
  
  const handleProjectDecision = (projectId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE', selectedBullets: string[] = []) => {
    setProjectDecisions(prev => ({
      ...prev,
      [projectId]: { projectId, action, selectedBullets }
    }));
  };
  
  const handleBulletSelection = (roleId: string, bulletId: string, selected: boolean) => {
    const currentDecision = roleDecisions[roleId];
    if (currentDecision && currentDecision.action === 'CONDENSE') {
      const selectedBullets = selected 
        ? [...currentDecision.selectedBullets, bulletId]
        : currentDecision.selectedBullets.filter(id => id !== bulletId);
      
      handleRoleDecision(roleId, 'CONDENSE', selectedBullets);
    }
  };

  const handleBulletEdit = (itemId: string, bulletId: string, newText: string) => {
    setEditedBullets(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [bulletId]: newText
      }
    }));
  };

  const handleBulletDelete = (itemId: string, bulletId: string) => {
    // Remove bullet from the plan
    if (plan) {
      const updatedPlan = { ...plan };
      
      // Update roles
      updatedPlan.roles = plan.roles.map((role: any) => {
        if (role.id === itemId) {
          return {
            ...role,
            bullets: role.bullets.filter((bullet: any) => bullet.id !== bulletId)
          };
        }
        return role;
      });
      
      // Update projects
      updatedPlan.projects = plan.projects.map((project: any) => {
        if (project.id === itemId) {
          return {
            ...project,
            bullets: project.bullets.filter((bullet: any) => bullet.id !== bulletId)
          };
        }
        return project;
      });
      
      setPlan(updatedPlan);
    }
  };
  
  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Interactive Resume Optimizer
            </h1>
            <p className="text-lg text-gray-600">
              Upload your resume and job description to create an interactive optimization plan
            </p>
          </div>
          
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Create Optimization Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resume PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              
              <Button
                onClick={handleCreatePlan}
                disabled={loading || !file || !jobDescription.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4" />
                    Creating Plan...
                  </>
                ) : (
                  'Create Optimization Plan'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Interactive Resume Optimizer
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              Plan ID: {planId}
            </p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline">
            ← Back to Upload
          </Button>
        </div>
        
        {/* Fit Metrics */}
        {fit && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Fit Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(fit.overallScore * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(fit.experienceMatch * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Experience Match</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(fit.projectMatch * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Project Match</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(fit.skillCoverage * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Skill Coverage</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Role Decisions */}
          <RoleDecisionPanel
            roles={plan.roles}
            decisions={roleDecisions}
            planId={planId || ''}
            jdText={jobDescription}
            onDecisionChange={handleRoleDecision}
            onBulletEdit={handleBulletEdit}
            onBulletDelete={handleBulletDelete}
          />
          
          {/* Project Decisions */}
          <ProjectDecisionPanel
            projects={plan.projects}
            decisions={projectDecisions}
            planId={planId || ''}
            jdText={jobDescription}
            onDecisionChange={handleProjectDecision}
            onBulletEdit={handleBulletEdit}
            onBulletDelete={handleBulletDelete}
          />
        </div>
        
        {/* Enhanced Coverage Analysis */}
        <CoverageAnalysis
          coverage={plan.coverage}
          missingKeywords={fit?.missingKeywords || []}
          jdText={jobDescription}
        />
        
        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          <Button
            onClick={handleApplyDecisions}
            disabled={loading}
            size="lg"
          >
            {loading ? (
              <>
                <Loader className="mr-2 h-4 w-4" />
                Applying Decisions...
              </>
            ) : (
              'Apply Decisions & View Results'
            )}
          </Button>
        </div>
        
        {error && (
          <div className="mt-4 text-center text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}
