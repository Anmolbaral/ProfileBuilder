import React, { useState, useCallback } from 'react'
import { useMutation, gql } from '@apollo/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useNavigate } from 'react-router-dom'

const UPDATE_RESUME = gql`
  mutation UpdateResume($resume: Upload!, $jobDescription: String!) {
    updateResume(resume: $resume, jobDescription: $jobDescription) {
      downloadUrl
      summary
      changes
    }
  }
`;

export function PdfUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [updateResume, { loading, error }] = useMutation(UPDATE_RESUME)
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()

  const handleUpload = async () => {
    setErrorMsg(null)
    if (!file || !jobDescription.trim()) {
      setErrorMsg('Please provide both a resume PDF and a job description.')
      return
    }
    try {
      const result = await updateResume({ variables: { resume: file, jobDescription } })
      localStorage.setItem('updatedResumeResult', JSON.stringify(result.data.updateResume))
      navigate('/results')
    } catch (err) {
      setErrorMsg('Upload error: ' + (err instanceof Error ? err.message : 'Unknown error'))
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
      <div className="pdf-uploader">
        <nav className="pdf-uploader__nav">
          <div className="pdf-uploader__nav-content">
            <h1 className="pdf-uploader__title">PDF Parser</h1>
          </div>
        </nav>

        <main className="pdf-uploader__main">
          <div className="pdf-uploader__container">
            <div className="pdf-uploader__header">
              <h3 className="pdf-uploader__heading">Let's Parse your PDF</h3>
              <p className="pdf-uploader__subheading">Drag or Drop your PDF file</p>
            </div>

            <div className="pdf-uploader__card-container">
              <Card
                className={cn(
                  'pdf-uploader__card',
                  isDragging && 'pdf-uploader__card--dragging'
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="pdf-uploader__content">
                  <div className="pdf-uploader__icon-container">
                    <svg 
                      className="pdf-uploader__icon" 
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

                  <div className="pdf-uploader__controls">
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
                        <p className="pdf-uploader__file-name">
                          {file.name}
                        </p>
                      </>
                    )}
                  </div>
                  {/* Job Description Input */}
                  <div className="w-full mt-6">
                    <label htmlFor="job-description" className="block font-semibold mb-2">Paste Job Description</label>
                    <textarea
                      id="job-description"
                      className="w-full p-3 border rounded-lg min-h-[120px] text-base"
                      placeholder="Paste the job description or related info here..."
                      value={jobDescription}
                      onChange={e => setJobDescription(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  {/* Generate Button */}
                  <div className="w-full flex flex-col items-center mt-6 gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={loading || !file || !jobDescription.trim()}
                      className="bg-gradient-to-r from-green-600 via-green-500 to-green-400 hover:from-green-700 hover:via-green-600 hover:to-green-500 hover:scale-105 transition-transform w-full"
                    >
                      {loading ? 'Generating...' : 'Generate Updated Resume'}
                    </Button>
                    {file && (
                      <Button
                        onClick={() => setFile(null)}
                        className="bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:from-red-700 hover:via-red-600 hover:to-red-500 hover:scale-105 transition-transform mt-2 w-full"
                      >
                        Remove File
                      </Button>
                    )}
                  </div>
                  {errorMsg && (
                    <div className="pdf-uploader__error">{errorMsg}</div>
                  )}
                  {error && (
                    <div className="pdf-uploader__error">{error.message}</div>
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