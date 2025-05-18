// src/components/PdfUploader.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useMutation, gql } from '@apollo/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as Tooltip from '@radix-ui/react-tooltip'
import { DocumentVisualization } from './DocumentVisualization'
import { LoadingSkeleton } from './LoadingSkeleton'

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
`

export function PdfUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadPdf, { loading, error, data }] = useMutation(UPLOAD_PDF)
  const [showResults, setShowResults] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showResults && !loading) {
      resultsRef.current?.focus()
    }
  }, [showResults, loading])

  const handleUpload = async () => {
    if (!file) return
    setShowResults(false)
    try {
      const result = await uploadPdf({ variables: { file } })
      console.log('Upload result:', result)
      setShowResults(true)
    } catch (err) {
      console.error('Upload error:', err)
    }
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
    }
  }, [])

  const doc = data?.uploadPdf

  return (
    <Tooltip.Provider>
      <div className="w-screen min-h-screen flex flex-col items-center bg-gray-50 px-4 sm:px-8 md:px-16 lg:px-32">
        {/* Nav Bar */}
        <nav className="font-roboto w-full h-32 bg-white/40 backdrop-blur-md border-b border-gray-200 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-center">
            <h1 className="font-roboto text-[6vw] md:text-5xl lg:text-6xl font-extrabold gradient-text drop-shadow-lg select-none">
              PDF Parser
            </h1>
          </div>
        </nav>

        {/* Hero Section & Upload Card */}
        <main className="w-full flex flex-col items-center justify-center flex-1">
          <div className="w-full max-w-7xl mx-auto p-12 bg-white/30 backdrop-blur-sm shadow-xl mt-32 rounded-[3rem]">
            <div className="w-full flex flex-col items-center h-[100px] justify-between">
              <h1 className="text-8xl font-extrabold gradient-text text-center tracking-tight drop-shadow-xl select-none mt-8">
                Let's Parse your PDF
              </h1>
              <p className="text-5xl text-orange-500 text-center select-non h-[30px]">
                Drag or Drop your PDF file
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
                  <div className="flex items-center justify-center gap-6 w-full h-[70px]" style={{ gap: '24px' }}>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                      disabled={loading}
                    />
                    <Button
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={loading}
                      className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 hover:from-indigo-700 hover:via-blue-600 hover:to-cyan-500 hover:scale-105 transition-transform"
                    >
                      Browse Files
                    </Button>
                    {file && (
                      <p className="text-lg font-medium text-orange-500 min-w-[200px] text-center">
                        {file.name}
                      </p>
                    )}
                    {file && !loading && (
                      <Button
                        onClick={handleUpload}
                        className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 hover:from-indigo-700 hover:via-blue-600 hover:to-cyan-500 hover:scale-105 transition-transform"
                      >
                        Upload
                      </Button>
                    )}
                  </div>
                  {error && (
                    <div className="mt-4 text-red-500 text-sm">{error.message}</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>

        {/* Results Panel */}
        {(loading || showResults) && (
          <div
            tabIndex={-1}
            ref={resultsRef}
            className={cn(
              'results-panel',
              loading ? 'results-panel-loading' : 'results-panel-content'
            )}
          >
            <div className="w-full p-2 flex flex-col items-center justify-center">
              {loading && <LoadingSkeleton />}
              {doc && showResults && !loading && <DocumentVisualization doc={doc} />}
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  )
}