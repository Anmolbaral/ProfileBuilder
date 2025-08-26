import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BulletEditor } from './BulletEditor';

interface Bullet {
  id: string;
  text: string;
  jdMatchScore: number;
  impactScore: number;
  suggested: boolean;
}

interface Project {
  id: string;
  projectName: string;
  techStack: string;
  bullets: Bullet[];
  jdMatchScore: number;
}

interface ProjectDecision {
  projectId: string;
  action: 'KEEP' | 'CONDENSE' | 'HIDE';
  selectedBullets: string[];
}

interface ProjectDecisionPanelProps {
  projects: Project[];
  decisions: Record<string, ProjectDecision>;
  planId: string;
  jdText: string;
  onDecisionChange: (projectId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE', selectedBullets: string[]) => void;
  onBulletEdit: (projectId: string, bulletId: string, newText: string) => void;
  onBulletDelete?: (projectId: string, bulletId: string) => void;
}

export function ProjectDecisionPanel({ 
  projects, 
  decisions, 
  planId, 
  jdText, 
  onDecisionChange, 
  onBulletEdit,
  onBulletDelete 
}: ProjectDecisionPanelProps) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const handleDecisionChange = (projectId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE') => {
    const currentDecision = decisions[projectId];
    const selectedBullets = action === 'CONDENSE' && currentDecision?.action === 'CONDENSE' 
      ? currentDecision.selectedBullets 
      : [];
    
    onDecisionChange(projectId, action, selectedBullets);
  };

  const handleBulletSelection = (projectId: string, bulletId: string, selected: boolean) => {
    const currentDecision = decisions[projectId];
    if (currentDecision?.action === 'CONDENSE') {
      const selectedBullets = selected 
        ? [...currentDecision.selectedBullets, bulletId]
        : currentDecision.selectedBullets.filter(id => id !== bulletId);
      
      onDecisionChange(projectId, 'CONDENSE', selectedBullets);
    }
  };

  const handleBulletEdit = (projectId: string, bulletId: string, newText: string) => {
    onBulletEdit(projectId, bulletId, newText);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    return 'Needs Improvement';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-6 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">🚀 Project Decisions</h3>
        <p className="text-gray-600 text-base leading-relaxed">
          Choose how to handle each project: Keep all content, condense to selected bullets, or hide entirely.
        </p>
      </div>
      
      <div className="p-8 space-y-8">
        {projects.map((project) => {
          const decision = decisions[project.id];
          const isExpanded = expandedProject === project.id;
          
          return (
            <div key={project.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              {/* Project Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{project.projectName}</h3>
                    <p className="text-gray-700 text-base mb-4 font-medium">Tech Stack: {project.techStack}</p>
                    
                    {/* Enhanced Score Indicators */}
                    <div className="flex flex-wrap gap-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        getScoreColor(project.jdMatchScore).replace('text-', 'bg-').replace('-600', '-100') + ' ' + getScoreColor(project.jdMatchScore)
                      }`}>
                        JD Match: {Math.round(project.jdMatchScore * 100)}% ({getScoreLabel(project.jdMatchScore)})
                      </div>
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        Bullets: {project.bullets.length}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={decision?.action === 'KEEP' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(project.id, 'KEEP')}
                      className="min-w-[80px]"
                    >
                      Keep All
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.action === 'CONDENSE' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(project.id, 'CONDENSE')}
                      className="min-w-[80px]"
                    >
                      Condense
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.action === 'HIDE' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(project.id, 'HIDE')}
                      className="min-w-[80px]"
                    >
                      Hide
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      className="min-w-[80px]"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Decision Status */}
              {decision && (
                <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-purple-600 text-xl">📋</span>
                    <span className="text-lg font-semibold text-purple-800">
                      {decision.action === 'KEEP' && 'Keeping all content'}
                      {decision.action === 'CONDENSE' && `Condensing to ${decision.selectedBullets.length} selected bullets`}
                      {decision.action === 'HIDE' && 'Hiding this project'}
                    </span>
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">Project Details ({project.bullets.length} bullets)</h4>
                    <div className="text-sm text-gray-500">
                      {project.bullets.filter(b => b.suggested).length} AI suggested
                    </div>
                  </div>
                  
                  {/* Bullet Selection for Condense Mode */}
                  {decision?.action === 'CONDENSE' && (
                    <div className="p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center space-x-3 mb-4">
                        <span className="text-amber-600 text-xl">⚡</span>
                        <h5 className="text-lg font-semibold text-amber-800">
                          Select bullets to keep ({decision.selectedBullets.length} selected)
                        </h5>
                      </div>
                      <div className="space-y-3">
                        {project.bullets.map((bullet) => (
                          <label key={bullet.id} className="flex items-start space-x-4 p-3 bg-white rounded-lg border border-amber-200 hover:bg-amber-50 transition-all duration-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={decision.selectedBullets.includes(bullet.id)}
                              onChange={(e) => handleBulletSelection(project.id, bullet.id, e.target.checked)}
                              className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <p className="text-gray-800 text-sm leading-relaxed">{bullet.text}</p>
                              {bullet.suggested && (
                                <span className="inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  🤖 AI Suggested
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual Bullet Editors */}
                  <div className="space-y-6">
                    {project.bullets.map((bullet) => (
                      <BulletEditor
                        key={bullet.id}
                        bullet={bullet}
                        planId={planId}
                        jdText={jdText}
                        onEdit={(bulletId, newText) => handleBulletEdit(project.id, bulletId, newText)}
                        onDelete={onBulletDelete ? (bulletId) => onBulletDelete(project.id, bulletId) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No projects found</h3>
            <p className="text-gray-500 text-base">
              Make sure your resume has project sections with bullet points.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
