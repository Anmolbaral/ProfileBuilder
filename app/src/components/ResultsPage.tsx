import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Link } from 'react-router-dom';

export default function ResultsPage() {
  const [doc, setDoc] = useState<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pdfResults');
    if (stored) setDoc(JSON.parse(stored));
    resultsRef.current?.focus();
  }, []);

  if (!doc) {
    return (
      <div className="w-screen min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <nav className="font-roboto w-full h-32 bg-white/40 backdrop-blur-md border-b border-gray-200 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-center">
            <Link to="/">
              <h1 className="font-roboto text-[6vw] md:text-5xl lg:text-6xl font-extrabold gradient-text drop-shadow-lg select-none cursor-pointer">
                PDF Parser
              </h1>
            </Link>
          </div>
        </nav>
        <div className="mt-32 text-2xl text-gray-500">No results found. Please upload a PDF first.</div>
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      <div className="w-screen min-h-screen flex flex-col items-center bg-gray-50">
        <nav className="font-roboto w-full h-32 bg-white/40 backdrop-blur-md border-b border-gray-200 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-center">
            <Link to="/">
              <h1 className="font-roboto text-[6vw] md:text-5xl lg:text-6xl font-extrabold gradient-text drop-shadow-lg select-none cursor-pointer">
                PDF Parser
              </h1>
            </Link>
          </div>
        </nav>
        <main className="w-full flex-1 pt-20">
          <div
            tabIndex={-1}
            ref={resultsRef}
            className="bg-white rounded-3xl shadow-2xl mx-auto p-[100px] max-w-4xl"
          >
            <div className="flex flex-col items-center justify-center">
              <div className="h-full w-full flex flex-col items-center justify-center">
                <div className="mb-20"></div>
                <div className="flex flex-col gap-8 w-full">
                  {/* Metadata Card */}
                  <Card className="metadata-card w-full flex flex-col items-center justify-center result-card border-none mb-10 p-5">
                    <CardHeader className="w-full text-center pb-2">
                      <CardTitle className="metadata-card__header">Document Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 w-full">
                      <div className="table-wrapper">
                        <table className="details-table">
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
                              <td>{doc.metadata?.pageCount ?? '—'}</td>
                            </tr>
                            <tr>
                              <th>Summary</th>
                              <td>{doc.metadata?.summary ?? '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Raw Text Card */}
                  <Card className="metadata-card w-full flex flex-col items-center justify-center result-card border-none p-5">
                    <CardHeader className="w-full text-center pb-2">
                      <CardTitle className="metadata-card__header">Raw Text</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 w-full">
                      <div className="table-wrapper p-5">
                        <div className="details-table bg-[var(--card-bg)] rounded-lg">
                          <pre className="raw-text whitespace-pre-wrap p-10 text-[var(--fg)]">
                            {doc.rawText}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  );
} 