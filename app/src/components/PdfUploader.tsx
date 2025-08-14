import React, { useState, useCallback, useEffect } from 'react'
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
      updatedResumeJson
    }
  }
`;

interface UploadProgress {
  stage: 'idle' | 'uploading' | 'pfirrocessing' | 'generating' | 'completing' | 'done' | 'error';
  progress: number;
  message: string;
  estimatedTime?: number;
}

export function PdfUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [updateResume, { loading, error }] = useMutation(UPDATE_RESUME)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
    message: ''
  })
  const [retryCount, setRetryCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const navigate = useNavigate()

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log('Network connection restored')
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      console.log('Network connection lost')
      setErrorMsg('No internet connection. Please check your network and try again.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Server connectivity check with detailed logging
  const checkServerHealth = async () => {
    console.log('🔍 Starting server health check...')
    try {
      console.log('📡 Making request to GraphQL endpoint...')
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: 'query { __typename }'
        }),
        mode: 'cors',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      console.log('📬 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Server is healthy, response:', data)
        return true
      } else {
        console.error('❌ Server returned error:', response.status, response.statusText)
        return false
      }
    } catch (error) {
      console.error('❌ Server connectivity check failed:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      return false
    }
  }

  // Add global debug function for testing
  React.useEffect(() => {
    // Make debug function available globally
    (window as any).debugServerConnection = checkServerHealth
    console.log('🔧 Debug function available: window.debugServerConnection()')
  }, [checkServerHealth])

  // Progress simulation for better UX during long operations
  const simulateProgress = (stage: UploadProgress['stage'], message: string, targetProgress: number) => {
    return new Promise<void>((resolve) => {
      let currentProgress = uploadProgress.progress;
      const increment = (targetProgress - currentProgress) / 20;
      
      const updateProgress = () => {
        currentProgress = Math.min(currentProgress + increment, targetProgress);
        setUploadProgress(prev => ({
          ...prev,
          stage,
          progress: Math.round(currentProgress),
          message,
          estimatedTime: targetProgress === 100 ? 0 : Math.max(1, Math.round((100 - currentProgress) / 10))
        }));
        
        if (currentProgress < targetProgress) {
          setTimeout(updateProgress, 100);
        } else {
          setTimeout(resolve, 300);
        }
      };
      updateProgress();
    });
  };

  const handleUpload = async () => {
    setErrorMsg(null)
    setRetryCount(0)
    
    // Pre-flight checks
    if (!isOnline) {
      setErrorMsg('No internet connection. Please check your network and try again.')
      return
    }
    
    if (!file) {
      setErrorMsg('Please select a PDF file.')
      return
    }

    // File size validation (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size too large. Please select a PDF smaller than 10MB.')
      return
    }
    
    // File type validation
    if (file.type !== 'application/pdf') {
      setErrorMsg('Please select a valid PDF file.')
      return
    }
    
    try {
      // Pre-upload server connectivity check
      console.log('🔍 Checking server connectivity...')
      const serverHealthy = await checkServerHealth()
      if (!serverHealthy) {
        throw new Error('Server is currently unavailable. Please try again later.')
      }
      
      // Additional test: Check if GraphQL endpoint is responding
      console.log('🔍 Testing GraphQL endpoint specifically...')
      try {
        const testQuery = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            query: 'query TestQuery { __typename }'
          }),
          mode: 'cors'
        })
        
        console.log('🔍 GraphQL endpoint test response:', {
          status: testQuery.status,
          statusText: testQuery.statusText,
          ok: testQuery.ok
        })
        
        if (testQuery.ok) {
          const testData = await testQuery.json()
          console.log('✅ GraphQL endpoint is responding:', testData)
        } else {
          console.warn('⚠️ GraphQL endpoint returned non-200:', await testQuery.text())
        }
      } catch (gqlTestError) {
        console.error('❌ GraphQL endpoint test failed:', gqlTestError)
      }

      // Test if CSRF protection is still enabled by trying a simple multipart request
      console.log('🔍 Testing CSRF protection status...')
      try {
        const csrfTestData = new FormData()
        csrfTestData.append('operations', JSON.stringify({
          query: 'query TestQuery { __typename }',
          variables: {}
        }))
        
        const csrfTest = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          body: csrfTestData,
          mode: 'cors'
        })
        
        console.log('🔍 CSRF test response:', {
          status: csrfTest.status,
          statusText: csrfTest.statusText,
          ok: csrfTest.ok
        })
        
        const csrfTestText = await csrfTest.text()
        console.log('🔍 CSRF test response body:', csrfTestText)
        
        if (csrfTestText.includes('Cross-Site Request Forgery')) {
          console.error('❌ CSRF protection is still enabled on server!')
          setErrorMsg('Server needs to be updated with CSRF protection disabled. Please deploy the latest server changes.')
      return
        } else {
          console.log('✅ CSRF protection appears to be disabled')
        }
      } catch (csrfTestError) {
        console.error('❌ CSRF test failed:', csrfTestError)
      }

      // Stage 1: File Upload
      setUploadProgress({ stage: 'uploading', progress: 0, message: 'Uploading your resume...' })
      await simulateProgress('uploading', 'Uploading your resume...', 25)
      
      // Stage 2: Processing
      await simulateProgress('processing', 'Processing PDF content...', 40)
      
      // Stage 3: AI Generation
      await simulateProgress('generating', 'AI is analyzing and optimizing your resume...', 75)
      
      // Stage 4: Final processing
      await simulateProgress('completing', 'Finalizing your optimized resume...', 90)
      
      // Actual API call
      const startTime = Date.now()
      console.log('Starting GraphQL mutation with file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isValidPdf: file.type === 'application/pdf',
        fileConstructor: file.constructor.name
      })
      
      console.log('File object details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        isFile: file instanceof File,
        isBlob: file instanceof Blob
      })
      
      console.log('Job description length:', jobDescription.length)
      console.log('Job description preview:', jobDescription.substring(0, 100))
      
      // Test if the file is readable
      try {
        const testRead = await file.slice(0, 100).text()
        console.log('File is readable, first 100 chars:', testRead.substring(0, 50))
      } catch (e) {
        console.error('File is not readable:', e)
      }
      
      // Ensure job description is not empty or just whitespace
      if (!jobDescription || jobDescription.trim().length === 0) {
        throw new Error('Job description cannot be empty. Please provide a job description.')
      }
      
      console.log('🚀 SENDING MUTATION - Full details:', {
        mutationName: 'updateResume',
        variables: {
          resume: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            constructor: file.constructor.name
          },
          jobDescription: {
            length: jobDescription.trim().length,
            preview: jobDescription.trim().substring(0, 200),
            isEmpty: !jobDescription.trim(),
            isWhitespace: jobDescription.trim() !== jobDescription
          }
        },
        fileValidation: {
          isPDF: file.type === 'application/pdf',
          sizeUnderLimit: file.size <= 10 * 1024 * 1024,
          hasContent: file.size > 0
        }
      })
      
      // Test file readability one more time
      try {
        const chunk = file.slice(0, 4);
        const arrayBuffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const pdfSignature = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('📄 PDF File signature check:', {
          firstBytes: pdfSignature,
          isPDFSignature: pdfSignature.startsWith('25 50 44 46') // %PDF
        });
      } catch (e) {
        console.error('❌ File signature check failed:', e);
      }
      
      console.log('📡 About to call Apollo mutation...');
      
      // TEMPORARY: Test with direct fetch to bypass Apollo
      console.log('🧪 TESTING: Direct fetch upload (bypassing Apollo)...');
      try {
        const formData = new FormData();
        formData.append('operations', JSON.stringify({
          query: `
            mutation UpdateResume($resume: Upload!, $jobDescription: String!) {
              updateResume(resume: $resume, jobDescription: $jobDescription) {
                downloadUrl
                summary
                changes
                updatedResumeJson
              }
            }
          `,
          variables: {
            resume: null,
            jobDescription: jobDescription.trim()
          }
        }));
        formData.append('map', JSON.stringify({
          "0": ["variables.resume"]
        }));
        formData.append('0', file);

        console.log('🧪 FormData entries:', Array.from(formData.entries()).map(([key, value]) => ({
          key,
          valueType: typeof value,
          valueSize: value instanceof File ? value.size : value.length
        })));

        const directResult = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'omit'
        });

        console.log('🧪 Direct fetch response:', {
          status: directResult.status,
          statusText: directResult.statusText,
          ok: directResult.ok,
          headers: Object.fromEntries(directResult.headers.entries())
        });

        const directResponseText = await directResult.text();
        console.log('🧪 Direct fetch response body:', directResponseText);

        if (!directResult.ok) {
          console.error('❌ Direct fetch failed:', {
            status: directResult.status,
            statusText: directResult.statusText,
            body: directResponseText
          });
        } else {
          console.log('✅ Direct fetch succeeded!');
          const directData = JSON.parse(directResponseText);
          console.log('🎉 Direct fetch result:', directData);
          
          // If direct fetch works, use its result
          if (directData.data?.updateResume) {
            const result = { data: directData.data };
            console.log('🔄 Using direct fetch result instead of Apollo');
            
            console.log('GraphQL mutation successful:', result);
            
            const processingTime = Date.now() - startTime;
            console.log(`Resume processing completed in ${processingTime}ms`);
            
            // Stage 5: Complete
            setUploadProgress({ stage: 'done', progress: 100, message: 'Success! Redirecting to results...' });
            
            // Cache result with timestamp for freshness
            const resultWithMetadata = {
              ...result.data.updateResume,
              processedAt: Date.now(),
              processingTime
            };
            localStorage.setItem('resumeAnalysisResult', JSON.stringify(resultWithMetadata));
            
            // Small delay for better UX before redirect
            setTimeout(() => navigate('/results'), 1000);
            return; // Exit early, skip Apollo call
          }
        }
      } catch (directError) {
        console.error('🧪 Direct fetch also failed:', directError);
      }
      
      console.log('🔄 Falling back to Apollo mutation...');
      const result = await updateResume({ 
        variables: { 
          resume: file,
          jobDescription: jobDescription.trim()
        }
      })
      
      console.log('GraphQL mutation successful:', result)
      
      const processingTime = Date.now() - startTime
      console.log(`Resume processing completed in ${processingTime}ms`)
      
      // Stage 5: Complete
      setUploadProgress({ stage: 'done', progress: 100, message: 'Success! Redirecting to results...' })
      
      // Cache result with timestamp for freshness
      const resultWithMetadata = {
        ...result.data.updateResume,
        processedAt: Date.now(),
        processingTime
      }
      localStorage.setItem('resumeAnalysisResult', JSON.stringify(resultWithMetadata))
      
      // Small delay for better UX before redirect
      setTimeout(() => navigate('/results'), 1000)
      
    } catch (err) {
      console.error('❌ UPLOAD ERROR - Complete details:', {
        errorType: err?.constructor?.name || 'Unknown',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        
        // Apollo-specific error details
        graphQLErrors: (err as any)?.graphQLErrors?.map((gqlErr: any) => ({
          message: gqlErr.message,
          locations: gqlErr.locations,
          path: gqlErr.path,
          extensions: gqlErr.extensions
        })),
        
        networkError: (err as any)?.networkError ? {
          name: (err as any).networkError.name,
          message: (err as any).networkError.message,
          statusCode: (err as any).networkError.statusCode,
          response: (err as any).networkError.response,
          bodyText: (err as any).networkError.bodyText
        } : null,
        
        // Additional Apollo error info
        extraInfo: (err as any)?.extraInfo,
        clientErrors: (err as any)?.clientErrors,
        source: (err as any)?.source,
        
        // Full error object for debugging
        fullError: err
      })
      setUploadProgress({ stage: 'error', progress: 0, message: 'Upload failed' })
      
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : 'unknown error'
      let userFriendlyMessage = ''
      let isRetryable = false
      
      // Categorize errors for better user experience
      if (errorMessage.includes('failed to fetch')) {
        userFriendlyMessage = 'Connection failed. Please check your internet connection and try again.'
        isRetryable = true
      } else if (errorMessage.includes('cors') || errorMessage.includes('cross-origin')) {
        userFriendlyMessage = 'Security restriction detected. Please try refreshing the page.'
        isRetryable = false
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = 'Request timed out. The server might be busy, please try again.'
        isRetryable = true
      } else if (errorMessage.includes('network error') || errorMessage.includes('network')) {
        userFriendlyMessage = 'Network error occurred. Please check your connection.'
        isRetryable = true
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || 
                 errorMessage.includes('503') || errorMessage.includes('504')) {
        userFriendlyMessage = 'Server error occurred. Please try again in a moment.'
        isRetryable = true
      } else if (errorMessage.includes('400')) {
        userFriendlyMessage = 'Invalid request. Please check your file and job description.'
        isRetryable = false
      } else if (errorMessage.includes('413')) {
        userFriendlyMessage = 'File too large. Please use a smaller PDF file.'
        isRetryable = false
      } else {
        userFriendlyMessage = `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        isRetryable = false
      }
      
      // No auto-retry - let user decide
      setErrorMsg(userFriendlyMessage)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setJobDescription('')
    setErrorMsg(null)
    setUploadProgress({ stage: 'idle', progress: 0, message: '' })
    setRetryCount(0)
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
        <nav className="results-page__nav">
          <div className="results-page__nav-content">
            <h1 className="results-page__title">AI Resume Personalizer</h1>
          </div>
        </nav>

        <main className="pdf-uploader__main">
          <div className="pdf-uploader__container">
            <div className="pdf-uploader__header">
              <h3 className="pdf-uploader__heading">Let's Parse your PDF</h3>
              {!isOnline && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-700 text-sm font-medium">No internet connection</span>
                </div>
              )}
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
                    <label htmlFor="job-description" className="block font-semibold mb-2 text-white">Paste Job Description</label>
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
                    {uploadProgress.stage === 'idle' ? (
                      <>
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
                            disabled={loading}
                        className="bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:from-red-700 hover:via-red-600 hover:to-red-500 hover:scale-105 transition-transform mt-2 w-full"
                      >
                        Remove File
                      </Button>
                        )}
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                          <div 
                            className={`h-3 rounded-full transition-all duration-300 ${
                              uploadProgress.stage === 'error' 
                                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                : uploadProgress.stage === 'done'
                                ? 'bg-gradient-to-r from-green-500 to-green-600'
                                : 'bg-gradient-to-r from-blue-500 to-purple-600'
                            }`}
                            style={{ width: `${uploadProgress.progress}%` }}
                          />
                        </div>
                        
                        {/* Progress Text */}
                        <div className="text-center space-y-2">
                          <p className="font-medium text-white">{uploadProgress.message}</p>
                          <div className="flex justify-center items-center space-x-4 text-sm text-white">
                            <span>{uploadProgress.progress}% complete</span>
                            {uploadProgress.estimatedTime && uploadProgress.estimatedTime > 0 && (
                              <span>• Est. {uploadProgress.estimatedTime}s remaining</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons during progress */}
                        {uploadProgress.stage === 'error' ? (
                          <div className="space-y-4 w-full">
                            <div className="flex gap-3">
                              <Button
                                onClick={handleUpload}
                                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex-1"
                              >
                                Retry Upload
                              </Button>
                              <Button
                                onClick={resetUpload}
                                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 flex-1"
                              >
                                Start Over
                              </Button>
                            </div>
                            <Button
                              onClick={async () => {
                                setErrorMsg('Testing connection...')
                                const healthy = await checkServerHealth()
                                if (healthy) {
                                  setErrorMsg('✅ Server connection successful! You can try uploading again.')
                                } else {
                                  setErrorMsg('❌ Server connection failed. Please try again later or contact support.')
                                }
                              }}
                              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 w-full text-sm mt-2"
                            >
                              🔧 Test Server Connection
                            </Button>
                          </div>
                        ) : uploadProgress.stage !== 'done' && (
                          <Button
                            onClick={resetUpload}
                            disabled={uploadProgress.stage === 'completing'}
                            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 w-full"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
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