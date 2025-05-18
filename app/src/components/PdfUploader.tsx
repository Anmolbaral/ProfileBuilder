// src/components/PdfUploader.tsx
import React, { useState, useCallback } from 'react'
import { useMutation, gql } from '@apollo/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useNavigate } from 'react-router-dom'

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
  const [uploadPdf, { loading, error }] = useMutation(UPLOAD_PDF)
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()

  const handleUpload = async () => {
    if (!file) return
    try {
      const result = await uploadPdf({ variables: { file } })
      localStorage.setItem('pdfResults', JSON.stringify(result.data.uploadPdf))
      navigate('/results')
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

        {/* Main Content */}
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

                  {/* File Display
                  {file && (
                    <div className="w-full flex items-center justify-between bg-white p-4 rounded-lg shadow">
                      <div className="flex items-center gap-4">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-lg font-medium text-gray-700">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFile(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  )} */}

                  {/* Upload controls */}
                  <div className="flex items-center justify-center gap-6 w-full h-[70px] bg-white rounded-xl relative z-10" style={{ gap: '24px' }}>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                      disabled={loading || file !== null}
                    />
                    <Button
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={loading || file !== null}
                      className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 hover:from-indigo-700 hover:via-blue-600 hover:to-cyan-500 hover:scale-105 transition-transform"
                    >
                      Select PDF
                    </Button>
                    {file && (
                      <>
                        <p className="text-lg font-medium text-orange-500 min-w-[200px] text-center">
                          {file.name}
                        </p>
                        <Button
                          onClick={handleUpload}
                          disabled={loading}
                          className="bg-gradient-to-r from-green-600 via-green-500 to-green-400 hover:from-green-700 hover:via-green-600 hover:to-green-500 hover:scale-105 transition-transform"
                        >
                          {loading ? 'Uploading...' : 'Upload'}
                        </Button>
                      </>
                    )}
                  </div>
                  {file && (
                    <Button
                      onClick={() => setFile(null)}
                      className="bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:from-red-700 hover:via-red-600 hover:to-red-500 hover:scale-105 transition-transform mt-4"
                    >
                      Remove File
                    </Button>
                  )}
                  {error && (
                    <div className="mt-4 text-red-500 text-sm">{error.message}</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  )
}