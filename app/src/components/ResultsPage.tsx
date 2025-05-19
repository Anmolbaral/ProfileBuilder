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
  // const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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