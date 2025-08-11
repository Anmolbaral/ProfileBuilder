import { useState, useEffect } from 'react';

interface ResumeAnalysis {
  feedback?: {
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
  optimizedResume?: any;
  templateInfo?: {
    templateName: string;
    optimizedFor: string;
    features: string[];
  };
}

export function useResumeAnalysis(documentId?: string) {
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Simulated API call - replace with actual implementation
        const response = await fetch(`/api/analysis/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analysis');
        }
        const data = await response.json();
        setAnalysis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [documentId]);

  return {
    analysis,
    loading,
    error,
    refetch: () => {
      if (documentId) {
        // Trigger refetch logic here
      }
    }
  };
}