import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, CircularProgress, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Link } from 'react-router-dom';

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

const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const [updatedResume, setUpdatedResume] = useState<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for updated resume result first
    const updated = localStorage.getItem('updatedResumeResult');
    if (updated) {
      try {
        setUpdatedResume(JSON.parse(updated));
        setLoading(false);
        return;
      } catch (e) {
        setError('Failed to parse updated resume result.');
        setLoading(false);
        return;
      }
    }
    // Fallback: fetch old results
    const fetchResults = async () => {
      try {
        const response = await fetch('https://profilebuilder-uejc.onrender.com/graphql', {
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
          // Get the most recent document
          const latestDoc = documents.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" gutterBottom>
            Error: {error}
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ mt: 2 }}
          >
            Back to Upload
          </Button>
        </Paper>
      </Container>
    );
  }

  // Show updated resume result if available
  if (updatedResume) {
    // Log the structure for debugging
    console.log('updatedResume:', updatedResume);
    // Helper to render the updated resume JSON
    const renderResumePreview = (resume: any) => {
      if (!resume || Object.keys(resume).length === 0) return null;
      // Try to find the resume object
      const data = resume.updatedResumeJson || resume.resume || resume.updatedResume || resume;
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
      // If it looks like a resume, render it
      if (data.professionalSummary || data.skills || data.experience || data.projects) {
        return (
          <div className="updated-resume-preview p-4 mb-6 bg-white rounded shadow">
            {data.professionalSummary && (
              <section className="mb-4">
                <h2 className="font-bold text-lg mb-1">Professional Summary</h2>
                <p>{data.professionalSummary}</p>
              </section>
            )}
            {data.skills && Array.isArray(data.skills) && data.skills.length > 0 && (
              <section className="mb-4">
                <h2 className="font-bold text-lg mb-1">Skills</h2>
                <ul className="list-disc list-inside">
                  {data.skills.map((skill: string, idx: number) => (
                    <li key={idx}>{skill}</li>
                  ))}
                </ul>
              </section>
            )}
            {data.experience && Array.isArray(data.experience) && data.experience.length > 0 && (
              <section className="mb-4">
                <h2 className="font-bold text-lg mb-1">Experience</h2>
                {data.experience.map((role: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <div className="font-semibold">{role.title} {role.company && `@ ${role.company}`}</div>
                    {role.dates && <div className="text-sm text-gray-500">{role.dates}</div>}
                    {role.bullets && Array.isArray(role.bullets) && (
                      <ul className="list-disc list-inside ml-4">
                        {role.bullets.map((bullet: string, bidx: number) => (
                          <li key={bidx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            )}
            {data.projects && Array.isArray(data.projects) && data.projects.length > 0 && (
              <section className="mb-4">
                <h2 className="font-bold text-lg mb-1">Projects</h2>
                {data.projects.map((project: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <div className="font-semibold">{project.name}</div>
                    {project.description && <div>{project.description}</div>}
                    {project.technologies && Array.isArray(project.technologies) && (
                      <div className="text-sm text-gray-500">Tech: {project.technologies.join(', ')}</div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        );
      }
      // Fallback: show raw JSON
      return <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>;
    };
    return (
      <div className="results-page">
        <nav className="results-page__nav">
          <div className="results-page__nav-content">
            <Link to="/">
              <h1 className="results-page__title">PDF Parser</h1>
            </Link>
          </div>
        </nav>
        <main className="results-page__main">
          <div className="results-page__content" ref={resultsRef}>
            <div className="results-page__container">
              <div className="results-page__spacer"></div>
              <div className="results-page__grid">
                {/* Render the resume preview if available */}
                {renderResumePreview(updatedResume)}
                <Card className="results-page__card">
                  <CardHeader className="results-page__card-header">
                    <CardTitle className="results-page__card-title">Updated Resume</CardTitle>
                  </CardHeader>
                  <CardContent className="results-page__card-content">
                    {updatedResume.downloadUrl ? (
                      <a
                        href={updatedResume.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        download
                      >
                        Download Updated Resume
                      </a>
                    ) : (
                      <Typography color="error">No download link available.</Typography>
                    )}
                  </CardContent>
                </Card>
                {updatedResume.summary && (
                  <Card className="results-page__card">
                    <CardHeader className="results-page__card-header">
                      <CardTitle className="results-page__card-title">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="results-page__card-content">
                      <Typography>{updatedResume.summary}</Typography>
                    </CardContent>
                  </Card>
                )}
                {updatedResume.changes && Object.keys(updatedResume.changes).length > 0 && (
                  <Card className="results-page__card">
                    <CardHeader className="results-page__card-header">
                      <CardTitle className="results-page__card-title">Changes</CardTitle>
                    </CardHeader>
                    <CardContent className="results-page__card-content">
                      <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
                        {JSON.stringify(updatedResume.changes, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="results-page">
        <nav className="results-page__nav">
          <div className="results-page__nav-content">
            <Link to="/">
              <h1 className="results-page__title">PDF Parser</h1>
            </Link>
          </div>
        </nav>
        <div className="results-page__main">
          <div className="results-page__content">
            <div className="results-page__container">
              <div className="results-page__spacer"></div>
              <div className="results-page__grid">
                <div className="results-page__card">
                  <div className="results-page__card-header">
                    <h2 className="results-page__card-title">No results found. Please upload a PDF first.</h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      <div className="results-page">
        <nav className="results-page__nav">
          <div className="results-page__nav-content">
            <Link to="/">
              <h1 className="results-page__title">PDF Parser</h1>
            </Link>
          </div>
        </nav>
        <main className="results-page__main">
          <div
            tabIndex={-1}
            ref={resultsRef}
            className="results-page__content"
          >
            <div className="results-page__container">
              <div className="results-page__spacer"></div>
              <div className="results-page__grid">
                {/* Metadata Card */}
                <Card className="results-page__card">
                  <CardHeader className="results-page__card-header">
                    <CardTitle className="results-page__card-title">Document Details</CardTitle>
                  </CardHeader>
                  <CardContent className="results-page__card-content">
                    <div className="results-page__table-wrapper">
                      <table className="results-page__table">
                        <tbody>
                          <tr>
                            <th>ID</th>
                            <td>{doc.id}</td>
                          </tr>
                          <tr>
                            <th>Filename</th>
                            <td>{doc.filename}</td>
                          </tr>
                          <tr>
                            <th>Created At</th>
                            <td>{new Date(doc.createdAt).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <th>Page Count</th>
                            <td>{summary?.pageCount ?? '—'}</td>
                          </tr>
                          <tr>
                            <th>Summary</th>
                            <td>{summary?.summary ?? '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Raw Text Card */}
                <Card className="results-page__card">
                  <CardHeader className="results-page__card-header">
                    <CardTitle className="results-page__card-title">Raw Text</CardTitle>
                  </CardHeader>
                  <CardContent className="results-page__card-content">
                    <div className="results-page__table-wrapper lined-paper-bg">
                      <div className="results-page__table">
                        <div className="results-page__table-content">
                          {doc.rawText}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  );
};

export default ResultsPage; 