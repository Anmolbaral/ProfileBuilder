import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';

const SUGGEST_BULLET_EDITS = gql`
  mutation SuggestBulletEdits(
    $planId: ID!
    $bulletId: ID!
    $currentText: String!
    $jdText: String!
    $mustInclude: [String!]!
  ) {
    suggestBulletEdits(
      planId: $planId
      bulletId: $bulletId
      currentText: $currentText
      jdText: $jdText
      mustInclude: $mustInclude
    )
  }
`;

interface BulletEditorProps {
  bullet: {
    id: string;
    text: string;
    jdMatchScore: number;
    impactScore: number;
    suggested: boolean;
  };
  planId: string;
  jdText: string;
  onEdit: (bulletId: string, newText: string) => void;
  onDelete?: (bulletId: string) => void;
}

export function BulletEditor({ bullet, planId, jdText, onEdit, onDelete }: BulletEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(bullet.text);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [suggestEdits] = useMutation(SUGGEST_BULLET_EDITS);

  const handleGetSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setShowSuggestions(false);
    
    try {
      const result = await suggestEdits({
        variables: {
          planId,
          bulletId: bullet.id,
          currentText: bullet.text,
          jdText,
          mustInclude: [] // Extract keywords from JD context
        }
      });
      
      setSuggestions(result.data.suggestBulletEdits);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([
        'Enhanced bullet point with quantifiable results',
        'Improved version with specific metrics',
        'Optimized bullet with clear impact'
      ]);
      setShowSuggestions(true);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSave = () => {
    onEdit(bullet.id, editedText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(bullet.text);
    setIsEditing(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setEditedText(suggestion);
    setShowSuggestions(false);
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
    <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 pr-6">
            {isEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg min-h-[100px] text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Edit bullet point..."
              />
            ) : (
              <div className="space-y-3">
                <p className="text-gray-800 text-base leading-relaxed">
                  {bullet.text}
                </p>
                {bullet.suggested && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    🤖 AI Suggested
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button 
                  size="sm" 
                  onClick={handleSave} 
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[70px]"
                >
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancel}
                  className="min-w-[70px]"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditing(true)}
                  className="min-w-[70px]"
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleGetSuggestions}
                  disabled={isLoadingSuggestions}
                  className="min-w-[70px]"
                >
                  {isLoadingSuggestions ? (
                    <Loader className="h-4 w-4" />
                  ) : (
                    '💡 AI'
                  )}
                </Button>
                {onDelete && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onDelete(bullet.id)}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 min-w-[70px]"
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Enhanced Score Indicators */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            getScoreColor(bullet.jdMatchScore).replace('text-', 'bg-').replace('-600', '-100') + ' ' + getScoreColor(bullet.jdMatchScore)
          }`}>
            JD Match: {Math.round(bullet.jdMatchScore * 100)}% ({getScoreLabel(bullet.jdMatchScore)})
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            getScoreColor(bullet.impactScore).replace('text-', 'bg-').replace('-600', '-100') + ' ' + getScoreColor(bullet.impactScore)
          }`}>
            Impact: {Math.round(bullet.impactScore * 100)}% ({getScoreLabel(bullet.impactScore)})
          </div>
        </div>

        {/* AI Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-blue-600 text-xl">🤖</span>
              <h4 className="text-lg font-bold text-blue-800">AI Suggestions</h4>
            </div>
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className="p-4 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <p className="text-gray-800 text-sm leading-relaxed">{suggestion}</p>
                </div>
              ))}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowSuggestions(false)}
              className="mt-4 bg-white hover:bg-gray-50"
            >
              Close Suggestions
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
