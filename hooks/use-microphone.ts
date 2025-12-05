"use client"

import { useState, useRef, useCallback } from "react"

interface UseMicrophoneReturn {
  isRecording: boolean
  hasPermission: boolean | null // null = not checked yet, true = granted, false = denied
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  requestPermission: () => Promise<boolean>
  recordingTime: number // Recording duration in seconds
}

/**
 * Custom hook for microphone access and audio recording.
 * 
 * Features:
 * - Request microphone permissions
 * - Start/stop recording using MediaRecorder API
 * - Convert MediaStream to Blob (WebM format)
 * - Handle permissions denied/errors
 * - Track recording duration
 * 
 * @returns Object with recording state and control functions
 */
export function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  /**
   * Request microphone permission from the user.
   * @returns Promise<boolean> - true if permission granted, false otherwise
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = "Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Edge."
        setError(errorMsg)
        setHasPermission(false)
        return false
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      })

      // Permission granted
      streamRef.current = stream
      setHasPermission(true)
      setError(null)

      // Stop all tracks to release the stream (we'll get a new one when recording)
      stream.getTracks().forEach(track => track.stop())
      streamRef.current = null

      return true
    } catch (err: any) {
      // Permission denied or error
      let errorMsg = "Failed to access microphone."
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Microphone permission denied. Please allow microphone access in your browser settings."
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No microphone found. Please connect a microphone and try again."
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Microphone is already in use by another application. Please close other applications using the microphone."
      } else if (err.name === "OverconstrainedError") {
        errorMsg = "Microphone constraints could not be satisfied. Please try a different microphone."
      } else if (err.message) {
        errorMsg = err.message
      }

      setError(errorMsg)
      setHasPermission(false)
      return false
    }
  }, [])

  /**
   * Start recording audio from the microphone.
   * Automatically requests permission if not already granted.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      chunksRef.current = []

      // Request permission if not already granted
      if (hasPermission !== true) {
        const granted = await requestPermission()
        if (!granted) {
          throw new Error("Microphone permission is required to record audio.")
        }
      }

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      streamRef.current = stream

      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported) {
        throw new Error("MediaRecorder is not supported in this browser.")
      }

      // Determine the best MIME type for the browser
      let mimeType = "audio/webm"
      const options: MediaRecorderOptions = {}

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus"
        options.mimeType = mimeType
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm"
        options.mimeType = mimeType
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus"
        options.mimeType = mimeType
      }
      // If none are supported, browser will use default

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Handle recording errors
      mediaRecorder.onerror = (event: any) => {
        setError("An error occurred while recording: " + (event.error?.message || "Unknown error"))
        setIsRecording(false)
        stopRecording()
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setRecordingTime(0)
      startTimeRef.current = Date.now()

      // Start timer for recording duration
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          setRecordingTime(elapsed)
        }
      }, 1000)

    } catch (err: any) {
      setError(err.message || "Failed to start recording")
      setIsRecording(false)
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      throw err
    }
  }, [hasPermission, requestPermission])

  /**
   * Stop recording and return the audio blob.
   * @returns Promise<Blob | null> - The recorded audio blob, or null if error
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    try {
      setError(null)

      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      // Stop MediaRecorder
      if (mediaRecorderRef.current && isRecording) {
        return new Promise<Blob | null>((resolve) => {
          mediaRecorderRef.current!.onstop = () => {
            // Create blob from chunks
            const blob = new Blob(chunksRef.current, { 
              type: chunksRef.current[0]?.type || "audio/webm" 
            })
            
            // Clean up
            chunksRef.current = []
            setIsRecording(false)
            setRecordingTime(0)
            startTimeRef.current = null

            // Stop all tracks to release the stream
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop())
              streamRef.current = null
            }

            mediaRecorderRef.current = null
            resolve(blob)
          }

          // Stop recording
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop()
          } else {
            // Already stopped, resolve immediately
            const blob = new Blob(chunksRef.current, { 
              type: chunksRef.current[0]?.type || "audio/webm" 
            })
            chunksRef.current = []
            setIsRecording(false)
            setRecordingTime(0)
            startTimeRef.current = null
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop())
              streamRef.current = null
            }
            mediaRecorderRef.current = null
            resolve(blob)
          }
        })
      }

      // Not recording, return null
      setIsRecording(false)
      setRecordingTime(0)
      return null
    } catch (err: any) {
      setError(err.message || "Failed to stop recording")
      setIsRecording(false)
      setRecordingTime(0)
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      return null
    }
  }, [isRecording])

  return {
    isRecording,
    hasPermission,
    error,
    startRecording,
    stopRecording,
    requestPermission,
    recordingTime,
  }
}

