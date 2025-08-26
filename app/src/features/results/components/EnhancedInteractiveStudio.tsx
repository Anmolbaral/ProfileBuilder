import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader, Edit3, Plus, Trash2, RotateCcw, Check, X, Sparkles, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  studioCard, 
  studioHeader, 
  studioBody, 
  pillMuted, 
  iconBtn, 
  primaryBtn, 
  subtleBtn, 
  fieldChip,
  baseTab,
  activeTab,
  idleTab
} from './studioPrimitives';

interface EnhancedInteractiveStudioProps {
  planId: string;
  originalResumeJson: any;
  jobDescription: string;
  onResumeUpdate: (updatedResume: any) => void;
  onScoresUpdate: (scores: any) => void;
}

interface EditorState {
  resumeJson: any;
  history: any[];
  historyIndex: number;
  pendingChanges: any[];
}

export function EnhancedInteractiveStudio({
  planId,
  originalResumeJson,
  jobDescription,
  onResumeUpdate,
  onScoresUpdate
}: EnhancedInteractiveStudioProps) {
  const [editorState, setEditorState] = useState<EditorState>({
    resumeJson: originalResumeJson,
    history: [originalResumeJson],
    historyIndex: 0,
    pendingChanges: []
  });

  const [activeTab, setActiveTab] = useState('experience');
  const [loading, setLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Real-time score calculation
  const currentScores = useMemo(() => {
    // This would call the recalculateScores mutation
    // For now, return mock scores that update based on content
    const experienceCount = editorState.resumeJson.experience?.length || 0;
    const projectCount = editorState.resumeJson.projects?.length || 0;
    const skillsCount = Array.isArray(editorState.resumeJson.skills) 
      ? editorState.resumeJson.skills.length 
      : Object.keys(editorState.resumeJson.skills || {}).length;

    return {
      overallScore: Math.round(Math.min(100, (experienceCount * 20 + projectCount * 15 + skillsCount * 2))),
      experienceMatch: Math.round(Math.min(100, experienceCount * 25)),
      projectMatch: Math.round(Math.min(100, projectCount * 30)),
      skillCoverage: Math.round(Math.min(100, skillsCount * 5)),
      keywordCoverage: Math.round(Math.min(100, skillsCount * 3)),
      impactScore: Math.round(Math.min(100, (experienceCount + projectCount) * 15))
    };
  }, [editorState.resumeJson]);

  // Update scores when they change
  React.useEffect(() => {
    onScoresUpdate(currentScores);
  }, [currentScores, onScoresUpdate]);

  const updateResumeJson = useCallback((updates: any) => {
    setEditorState(prev => {
      const newResumeJson = { ...prev.resumeJson, ...updates };
      const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), newResumeJson];
      
      const newState = {
        ...prev,
        resumeJson: newResumeJson,
        history: newHistory,
        historyIndex: prev.historyIndex + 1,
        pendingChanges: [...prev.pendingChanges, updates]
      };
      
      // Call onResumeUpdate with the updated resume JSON
      onResumeUpdate(newResumeJson);
      
      return newState;
    });
  }, [onResumeUpdate]);

  const undo = useCallback(() => {
    setEditorState(prev => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        return {
          ...prev,
          resumeJson: prev.history[newIndex],
          historyIndex: newIndex
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setEditorState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        return {
          ...prev,
          resumeJson: prev.history[newIndex],
          historyIndex: newIndex
        };
      }
      return prev;
    });
  }, []);

  const generateAiSuggestions = useCallback(async (sectionType: string, sectionId: string, improvementType: string) => {
    setLoading(true);
    try {
      // This would call the suggestSectionImprovement mutation
      // For now, simulate AI suggestions
      const currentSection = editorState.resumeJson[sectionType]?.find((item: any) => item.id === sectionId);
      
      setTimeout(() => {
        setAiSuggestions({
          sectionType,
          sectionId,
          original: currentSection,
          suggested: {
            ...currentSection,
            impactBullets: [
              ...(currentSection?.impactBullets || []),
              'AI-suggested improvement bullet point'
            ]
          },
          changes: [
            {
              type: 'addition',
              field: 'impactBullets',
              oldValue: null,
              newValue: 'AI-suggested improvement bullet point',
              impact: 'Increases impact score by 15%'
            }
          ],
          reasoning: 'Adding quantifiable achievements improves the overall impact of this section.'
        });
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error);
      setLoading(false);
    }
  }, [editorState.resumeJson]);

  const applySuggestion = useCallback((suggestion: any) => {
    if (suggestion.sectionType === 'experience') {
      const updatedExperience = editorState.resumeJson.experience.map((exp: any) => 
        exp.id === suggestion.sectionId ? suggestion.suggested : exp
      );
      updateResumeJson({ experience: updatedExperience });
    } else if (suggestion.sectionType === 'projects') {
      const updatedProjects = editorState.resumeJson.projects.map((proj: any) => 
        proj.id === suggestion.sectionId ? suggestion.suggested : proj
      );
      updateResumeJson({ projects: updatedProjects });
    }
    setAiSuggestions(null);
  }, [editorState.resumeJson, updateResumeJson]);

  const SectionEditor = ({ sectionType, items, title }: { sectionType: string; items: any[]; title: string }) => {
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [editingBullet, setEditingBullet] = useState<{itemId: string, bulletIndex: number} | null>(null);

    const handleAddItem = () => {
      const newItem = {
        id: `new-${Date.now()}`,
        position: sectionType === 'experience' ? 'New Position' : 'New Project',
        company: sectionType === 'experience' ? 'New Company' : 'New Tech Stack',
        duration: sectionType === 'experience' ? '2024 - Present' : '',
        impactBullets: ['New bullet point']
      };

      const updatedItems = [...items, newItem];
      updateResumeJson({ [sectionType]: updatedItems });
    };

    const handleEditItem = (itemId: string) => {
      setEditingItem(editingItem === itemId ? null : itemId);
    };

    const handleDuplicateItem = (itemId: string) => {
      const itemToDuplicate = items.find(item => item.id === itemId);
      if (itemToDuplicate) {
        const duplicatedItem = {
          ...itemToDuplicate,
          id: `duplicate-${Date.now()}`,
          position: `${itemToDuplicate.position} (Copy)`,
          company: `${itemToDuplicate.company} (Copy)`
        };
        const updatedItems = [...items, duplicatedItem];
        updateResumeJson({ [sectionType]: updatedItems });
      }
    };

    const handleDeleteItem = (itemId: string) => {
      const updatedItems = items.filter(item => item.id !== itemId);
      updateResumeJson({ [sectionType]: updatedItems });
    };

    const handleEditBullet = (itemId: string, bulletIndex: number) => {
      console.log('Edit bullet clicked:', { itemId, bulletIndex });
      setEditingBullet({ itemId, bulletIndex });
    };

    const handleUpdateBullet = (itemId: string, bulletIndex: number, newText: string) => {
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          const updatedBullets = [...(item.impactBullets || [])];
          updatedBullets[bulletIndex] = newText;
          return { ...item, impactBullets: updatedBullets };
        }
        return item;
      });
      updateResumeJson({ [sectionType]: updatedItems });
      setEditingBullet(null);
    };

    const handleDeleteBullet = (itemId: string, bulletIndex: number) => {
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          const updatedBullets = [...(item.impactBullets || [])];
          updatedBullets.splice(bulletIndex, 1);
          return { ...item, impactBullets: updatedBullets };
        }
        return item;
      });
      updateResumeJson({ [sectionType]: updatedItems });
    };

    const handleAddBullet = (itemId: string) => {
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          const updatedBullets = [...(item.impactBullets || []), 'New bullet point'];
          return { ...item, impactBullets: updatedBullets };
        }
        return item;
      });
      updateResumeJson({ [sectionType]: updatedItems });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className={primaryBtn} onClick={handleAddItem}>
            <Plus className="h-4 w-4" />
            Add {sectionType.slice(0, -1)}
          </button>
        </div>
        
        {items?.map((item: any, index: number) => (
          <div key={item.id || index} className={`${studioCard} mb-4`}>
            <div className={studioHeader}>
              <div>
                <p className="text-sm text-slate-500">{title}</p>
                <h4 className="text-base font-semibold">
                  {item.position || item.projectName || `${sectionType.slice(0, -1)} ${index + 1}`}
                </h4>
                <p className="text-sm text-slate-600">
                  {item.company || item.techStack || 'Details'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={iconBtn}
                  onClick={() => generateAiSuggestions(sectionType, item.id, 'enhance')}
                  disabled={loading}
                  title="AI Enhance"
                >
                  {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>
                <button 
                  className={iconBtn} 
                  title="Edit"
                  onClick={() => handleEditItem(item.id)}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button 
                  className={iconBtn} 
                  title="Duplicate"
                  onClick={() => handleDuplicateItem(item.id)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button 
                  className={iconBtn} 
                  title="Delete"
                  onClick={() => handleDeleteItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`${studioBody} space-y-2`}>
              <ul className="list-disc pl-6 marker:text-slate-400 space-y-2">
                {item.impactBullets?.map((bullet: string, bulletIndex: number) => (
                  <li key={bulletIndex} className="group flex items-start gap-2">
                    <span className="mt-2 text-slate-400">•</span>
                    {editingBullet?.itemId === item.id && editingBullet?.bulletIndex === bulletIndex ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            console.log('Input changed:', e.target.value);
                            const updatedItems = items.map(i => {
                              if (i.id === item.id) {
                                const updatedBullets = [...(i.impactBullets || [])];
                                updatedBullets[bulletIndex] = e.target.value;
                                return { ...i, impactBullets: updatedBullets };
                              }
                              return i;
                            });
                            updateResumeJson({ [sectionType]: updatedItems });
                          }}
                          onBlur={() => setEditingBullet(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingBullet(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button 
                          className={iconBtn} 
                          title="Save"
                          onClick={() => setEditingBullet(null)}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="flex-1 text-[15px]/6 text-slate-700 dark:text-slate-200">{bullet}</p>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <button 
                        className={`${iconBtn} ${editingBullet?.itemId === item.id && editingBullet?.bulletIndex === bulletIndex ? 'bg-indigo-100 border-indigo-300' : ''}`}
                        title="Edit"
                        onClick={() => handleEditBullet(item.id, bulletIndex)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button 
                        className={iconBtn} 
                        title="Delete"
                        onClick={() => handleDeleteBullet(item.id, bulletIndex)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button 
                className={`${subtleBtn} mt-2`}
                onClick={() => handleAddBullet(item.id)}
              >
                <Plus className="h-3 w-3" />
                Add Bullet Point
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const LivePreview = () => (
    <div className={`${studioCard} h-full`}>
      <div className={studioHeader}>
        <span className="font-semibold">Live Preview</span>
        <button 
          className={iconBtn}
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? "Hide Preview" : "Show Preview"}
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className={`${studioBody} h-[600px] overflow-y-auto`}>
        {showPreview ? (
          <div className="space-y-4 text-sm">
            {/* Contact Info */}
            {editorState.resumeJson.contactInfo && (
              <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-4">
                <h2 className="text-xl font-bold">{editorState.resumeJson.contactInfo.name}</h2>
                <p className="text-slate-600">{editorState.resumeJson.contactInfo.email}</p>
              </div>
            )}

            {/* Experience */}
            {editorState.resumeJson.experience?.length > 0 && (
              <div>
                <h3 className="font-bold text-lg mb-2">Experience</h3>
                {editorState.resumeJson.experience.map((exp: any, index: number) => (
                  <div key={index} className="mb-3">
                    <div className="flex justify-between">
                      <span className="font-semibold">{exp.position}</span>
                      <span className="text-slate-600">{exp.duration}</span>
                    </div>
                    <div className="text-slate-600">{exp.company}</div>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {exp.impactBullets?.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex} className="text-xs">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Projects */}
            {editorState.resumeJson.projects?.length > 0 && (
              <div>
                <h3 className="font-bold text-lg mb-2">Projects</h3>
                {editorState.resumeJson.projects.map((proj: any, index: number) => (
                  <div key={index} className="mb-3">
                    <div className="font-semibold">{proj.projectName}</div>
                    <div className="text-slate-600 text-sm">{proj.techStack}</div>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {proj.impactBullets?.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex} className="text-xs">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-500 mt-8">
            Preview hidden
          </div>
        )}
      </div>
    </div>
  );

  const ScorePanel = () => (
    <div className={`${studioCard} mt-4`}>
      <div className={studioHeader}>
        <h4 className="font-semibold">Real-time Scores</h4>
      </div>
      <div className={`${studioBody} grid grid-cols-1 md:grid-cols-2 gap-4`}>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Overall Score</span>
            <span className="font-semibold">{currentScores.overallScore}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-indigo-500 rounded-full transition-all duration-300" style={{width: `${currentScores.overallScore}%`}}/>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Experience Match</span>
            <span className="font-semibold">{currentScores.experienceMatch}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-emerald-500 rounded-full transition-all duration-300" style={{width: `${currentScores.experienceMatch}%`}}/>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Project Match</span>
            <span className="font-semibold">{currentScores.projectMatch}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-purple-500 rounded-full transition-all duration-300" style={{width: `${currentScores.projectMatch}%`}}/>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Skill Coverage</span>
            <span className="font-semibold">{currentScores.skillCoverage}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-orange-500 rounded-full transition-all duration-300" style={{width: `${currentScores.skillCoverage}%`}}/>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Keyword Coverage</span>
            <span className="font-semibold">{currentScores.keywordCoverage}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-blue-500 rounded-full transition-all duration-300" style={{width: `${currentScores.keywordCoverage}%`}}/>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Impact Score</span>
            <span className="font-semibold">{currentScores.impactScore}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div className="h-2 bg-green-500 rounded-full transition-all duration-300" style={{width: `${currentScores.impactScore}%`}}/>
          </div>
        </div>
      </div>
    </div>
  );

  const AiSuggestionsPanel = () => {
    if (!aiSuggestions) return null;

    return (
      <div className={`${studioCard} border-2 border-indigo-200`}>
        <div className={studioHeader}>
          <div className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-indigo-600" />
            <span className="font-semibold">AI Suggestions</span>
          </div>
        </div>
        <div className={`${studioBody} space-y-4`}>
          <div className="p-3 bg-indigo-50 rounded">
            <h4 className="font-semibold mb-2">Reasoning</h4>
            <p className="text-sm text-slate-700">{aiSuggestions.reasoning}</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Changes</h4>
            {aiSuggestions.changes.map((change: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                <span className={`${fieldChip} ${change.type === 'addition' ? 'bg-green-100 text-green-800' : change.type === 'removal' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'}`}>
                  {change.type}
                </span>
                <span className="text-sm flex-1">{change.field}: {change.newValue || change.oldValue}</span>
                <span className="text-xs text-slate-500">{change.impact}</span>
              </div>
            ))}
          </div>

          <div className="flex space-x-2">
            <button 
              className={`${primaryBtn} flex-1`}
              onClick={() => applySuggestion(aiSuggestions)}
            >
              <Check className="h-4 w-4" />
              Apply
            </button>
            <button 
              className={`${subtleBtn} flex-1`}
              onClick={() => setAiSuggestions(null)}
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Left Panel - Interactive Controls */}
      <div className="lg:col-span-2 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button className={subtleBtn} onClick={undo} disabled={editorState.historyIndex === 0}>
              <RotateCcw className="h-4 w-4" />
              Undo
            </button>
            <button className={subtleBtn} onClick={redo} disabled={editorState.historyIndex === editorState.history.length - 1}>
              <RotateCcw className="h-4 w-4 rotate-180" />
              Redo
            </button>
            <span className={`${pillMuted} px-3 py-1.5 text-sm`}>
              {editorState.pendingChanges.length} changes
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button className={subtleBtn}>
              Save Draft
            </button>
            <button className={subtleBtn}>
              Export PDF
            </button>
            <button className="rounded-xl px-3 h-9 bg-slate-900 text-white hover:bg-slate-800">
              Close Studio
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-4">
          <button 
            className={`${baseTab} ${activeTab === 'experience' ? activeTab : idleTab}`}
            onClick={() => setActiveTab('experience')}
          >
            Experience
          </button>
          <button 
            className={`${baseTab} ${activeTab === 'projects' ? activeTab : idleTab}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
          <button 
            className={`${baseTab} ${activeTab === 'skills' ? activeTab : idleTab}`}
            onClick={() => setActiveTab('skills')}
          >
            Skills
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'experience' && (
          <div className="space-y-4">
            <SectionEditor 
              sectionType="experience" 
              items={editorState.resumeJson.experience || []} 
              title="Work Experience"
            />
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-4">
            <SectionEditor 
              sectionType="projects" 
              items={editorState.resumeJson.projects || []} 
              title="Projects"
            />
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Skills</h3>
              <button className={primaryBtn}>
                <Plus className="h-4 w-4" />
                Add Skill
              </button>
            </div>
            
            <div className={`${studioCard}`}>
              <div className={`${studioBody}`}>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(editorState.resumeJson.skills) 
                    ? editorState.resumeJson.skills.map((skill: string, index: number) => (
                        <span key={index} className={`${fieldChip} cursor-pointer hover:bg-red-100`}>
                          {skill}
                          <X className="h-3 w-3 ml-1" />
                        </span>
                      ))
                    : Object.entries(editorState.resumeJson.skills || {}).map(([category, skills]: [string, any]) => (
                        <div key={category} className="w-full">
                          <h4 className="font-semibold mb-2">{category}</h4>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(skills) && skills.map((skill: string, index: number) => (
                              <span key={index} className={`${fieldChip} cursor-pointer hover:bg-red-100`}>
                                {skill}
                                <X className="h-3 w-3 ml-1" />
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Suggestions Panel */}
        <AiSuggestionsPanel />
      </div>

      {/* Right Panel - Live Preview & Scores */}
      <div className="space-y-6">
        <ScorePanel />
        <LivePreview />
      </div>
    </div>
  );
}
