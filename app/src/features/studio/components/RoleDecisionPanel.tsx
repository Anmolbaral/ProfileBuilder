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

interface Role {
  id: string;
  company: string;
  position: string;
  duration: string;
  location: string;
  bullets: Bullet[];
  jdMatchScore: number;
  impactScore: number;
}

interface RoleDecision {
  roleId: string;
  action: 'KEEP' | 'CONDENSE' | 'HIDE';
  selectedBullets: string[];
}

interface RoleDecisionPanelProps {
  roles: Role[];
  decisions: Record<string, RoleDecision>;
  planId: string;
  jdText: string;
  onDecisionChange: (roleId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE', selectedBullets: string[]) => void;
  onBulletEdit: (roleId: string, bulletId: string, newText: string) => void;
  onBulletDelete?: (roleId: string, bulletId: string) => void;
}

export function RoleDecisionPanel({ 
  roles, 
  decisions, 
  planId, 
  jdText, 
  onDecisionChange, 
  onBulletEdit,
  onBulletDelete 
}: RoleDecisionPanelProps) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleDecisionChange = (roleId: string, action: 'KEEP' | 'CONDENSE' | 'HIDE') => {
    const currentDecision = decisions[roleId];
    const selectedBullets = action === 'CONDENSE' && currentDecision?.action === 'CONDENSE' 
      ? currentDecision.selectedBullets 
      : [];
    
    onDecisionChange(roleId, action, selectedBullets);
  };

  const handleBulletSelection = (roleId: string, bulletId: string, selected: boolean) => {
    const currentDecision = decisions[roleId];
    if (currentDecision?.action === 'CONDENSE') {
      const selectedBullets = selected 
        ? [...currentDecision.selectedBullets, bulletId]
        : currentDecision.selectedBullets.filter(id => id !== bulletId);
      
      onDecisionChange(roleId, 'CONDENSE', selectedBullets);
    }
  };

  const handleBulletEdit = (roleId: string, bulletId: string, newText: string) => {
    onBulletEdit(roleId, bulletId, newText);
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">💼 Role Decisions</h3>
        <p className="text-gray-600 text-base leading-relaxed">
          Choose how to handle each role: Keep all content, condense to selected bullets, or hide entirely.
        </p>
      </div>
      
      <div className="p-8 space-y-8">
        {roles.map((role) => {
          const decision = decisions[role.id];
          const isExpanded = expandedRole === role.id;
          
          return (
            <div key={role.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              {/* Role Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{role.position}</h3>
                    <p className="text-gray-700 text-base mb-1 font-medium">{role.company}</p>
                    <p className="text-gray-500 text-sm mb-4">{role.duration} • {role.location}</p>
                    
                    {/* Enhanced Score Indicators */}
                    <div className="flex flex-wrap gap-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        getScoreColor(role.jdMatchScore).replace('text-', 'bg-').replace('-600', '-100') + ' ' + getScoreColor(role.jdMatchScore)
                      }`}>
                        JD Match: {Math.round(role.jdMatchScore * 100)}% ({getScoreLabel(role.jdMatchScore)})
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        getScoreColor(role.impactScore).replace('text-', 'bg-').replace('-600', '-100') + ' ' + getScoreColor(role.impactScore)
                      }`}>
                        Impact: {Math.round(role.impactScore * 100)}% ({getScoreLabel(role.impactScore)})
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={decision?.action === 'KEEP' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(role.id, 'KEEP')}
                      className="min-w-[80px]"
                    >
                      Keep All
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.action === 'CONDENSE' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(role.id, 'CONDENSE')}
                      className="min-w-[80px]"
                    >
                      Condense
                    </Button>
                    <Button
                      size="sm"
                      variant={decision?.action === 'HIDE' ? 'default' : 'outline'}
                      onClick={() => handleDecisionChange(role.id, 'HIDE')}
                      className="min-w-[80px]"
                    >
                      Hide
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                      className="min-w-[80px]"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Decision Status */}
              {decision && (
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-blue-600 text-xl">📋</span>
                    <span className="text-lg font-semibold text-blue-800">
                      {decision.action === 'KEEP' && 'Keeping all content'}
                      {decision.action === 'CONDENSE' && `Condensing to ${decision.selectedBullets.length} selected bullets`}
                      {decision.action === 'HIDE' && 'Hiding this role'}
                    </span>
                  </div>
                </div>
              )}

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">Bullet Points ({role.bullets.length})</h4>
                    <div className="text-sm text-gray-500">
                      {role.bullets.filter(b => b.suggested).length} AI suggested
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
                        {role.bullets.map((bullet) => (
                          <label key={bullet.id} className="flex items-start space-x-4 p-3 bg-white rounded-lg border border-amber-200 hover:bg-amber-50 transition-all duration-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={decision.selectedBullets.includes(bullet.id)}
                              onChange={(e) => handleBulletSelection(role.id, bullet.id, e.target.checked)}
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
                    {role.bullets.map((bullet) => (
                      <BulletEditor
                        key={bullet.id}
                        bullet={bullet}
                        planId={planId}
                        jdText={jdText}
                        onEdit={(bulletId, newText) => handleBulletEdit(role.id, bulletId, newText)}
                        onDelete={onBulletDelete ? (bulletId) => onBulletDelete(role.id, bulletId) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {roles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">💼</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No roles found</h3>
            <p className="text-gray-500 text-base">
              Make sure your resume has experience sections with bullet points.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
