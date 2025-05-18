import React, { useState, useCallback } from 'react';
import { useMutation, gql } from '@apollo/client';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useNavigate, Link } from 'react-router-dom';

const UPLOAD_PDF = gql`
  mutation UploadPdf($file: Upload!) {
    uploadPdf(file: $file) {
      id
      filename
      rawText
      metadata
      createdAt
    }
  }
`;

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadPdf, { loading, error }] = useMutation(UPLOAD_PDF);
  const [showSeeResults, setShowSeeResults] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (files.length === 0) return;
    setShowSeeResults(false);
    setUploadProgress({});
    
    try {
      const results = [];
      for (const file of files) {
        const result = await uploadPdf({ variables: { file } });
        results.push(result.data.uploadPdf);
        setUploadProgress(prev => ({ ...prev, [file.name]: true }));
      }
      setShowSeeResults(true);
      // Save results to localStorage for ResultsPage
      localStorage.setItem('pdfResults', JSON.stringify(results));
    } catch (err) {
      // handle error
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles].slice(0, 3)); // Limit to 3 files
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(file => file.type === 'application/pdf');
    setFiles(prev => [...prev, ...selectedFiles].slice(0, 3)); // Limit to 3 files
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Tooltip.Provider>
      <div className="w-screen min-h-screen flex flex-col items-center bg-gray-50 px-4 sm:px-8 md:px-16 lg:px-32">
        {/* Nav Bar */}
        <nav className="font-roboto w-full h-32 bg-white backdrop-blur-md border-b border-b-white z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-center">
            <Link to="/">
              <h1 className="font-roboto text-[6vw] md:text-5xl lg:text-6xl font-extrabold gradient-text drop-shadow-lg select-none cursor-pointer">
                PDF Parser
              </h1>
            </Link>
          </div>
        </nav>

        {/* Hero Section & Upload Card */}
        <main className="w-full flex flex-col items-center justify-center flex-1">
          <div className="w-full max-w-7xl mx-auto p-12 bg-white/30 backdrop-blur-sm shadow-xl mt-32 rounded-[3rem]">
            <div className="w-full flex flex-col items-center h-[100px] justify-between">
              <h1 className="text-8xl font-extrabold gradient-text text-center tracking-tight drop-shadow-xl select-none mt-8">
                Let's Parse your PDFs
              </h1>
              <p className="text-5xl text-orange-500 text-center select-non h-[30px]">
                Drag or Drop up to 3 PDF files
              </p>
            </div>

            <div className="w-full flex justify-center mt-16">
              <Card
                className={cn(
                  'group transition-shadow duration-300 w-full max-w-4xl p-16 rounded-3xl shadow-2xl flex flex-col items-center justify-center gap-10',
                  isDragging
                    ? 'border-2 border-blue-500 shadow-blue-200 drag-area'
                    : 'border-0 shadow-sm hover:shadow-lg drag-area'
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="flex flex-col mb-30 items-center gap-6 w-full mt-8">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-12">
                    <svg 
                      className="w-8 h-8 text-blue-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                      />
                    </svg>
                  </div>
                  
                  {/* File List */}
                  <div className="w-full space-y-4">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
                        <div className="flex items-center gap-4">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-lg font-medium text-gray-700">{file.name}</span>
                          {uploadProgress[file.name] && (
                            <span className="text-green-500">✓</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Upload controls */}
                  <div className="flex items-center justify-center gap-6 w-full h-[70px] bg-white rounded-xl relative z-10" style={{ gap: '24px' }}>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      disabled={loading || files.length >= 3}
                      multiple
                    />
                    <Button
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={loading || files.length >= 3}
                      className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 hover:from-indigo-700 hover:via-blue-600 hover:to-cyan-500 hover:scale-105 transition-transform"
                    >
                      Browse Files
                    </Button>
                    {files.length > 0 && (
                      <Button
                        onClick={handleUpload}
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 hover:from-indigo-700 hover:via-blue-600 hover:to-cyan-500 hover:scale-105 transition-transform flex items-center justify-center"
                      >
                        Upload All
                      </Button>
                    )}
                  </div>
                  {error && (
                    <div className="mt-4 text-red-500 text-sm">{error.message}</div>
                  )}
                  {showSeeResults && (
                    <Button
                      className="mt-8 bg-gradient-to-r from-orange-500 via-yellow-400 to-pink-400 hover:from-orange-600 hover:via-yellow-500 hover:to-pink-500 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg"
                      onClick={() => navigate('/results')}
                    >
                      See Results
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  );
} 