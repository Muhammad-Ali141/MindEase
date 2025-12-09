"use client"

import { useState, useEffect } from "react"
import { X, Brain, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { apiGetDiagnosticTestStatus, apiGetDiagnosticTestHistory, type TestHistoryItem } from "@/lib/api"
import { useRouter } from "next/navigation"

type ShareTestModalProps = {
  open: boolean
  onClose: () => void
  onShare: (testContext: string) => void
  onSkip: () => void
}

export function ShareTestModal({ open, onClose, onShare, onSkip }: ShareTestModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [testStatus, setTestStatus] = useState<any>(null)
  const [latestTest, setLatestTest] = useState<TestHistoryItem | null>(null)
  const [hasTests, setHasTests] = useState(false)

  useEffect(() => {
    if (open && user?.id) {
      loadTestData()
    }
  }, [open, user?.id])

  const loadTestData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const [status, history] = await Promise.all([
        apiGetDiagnosticTestStatus(user.id).catch(() => null),
        apiGetDiagnosticTestHistory(user.id).catch(() => ({ results: [] }))
      ])

      setTestStatus(status)
      
      // Get latest test result (exclude generic screening)
      const dailyTests = history.results.filter(r => r.test_type !== "generic-screening")
      if (dailyTests.length > 0) {
        setLatestTest(dailyTests[0]) // Most recent is first
        setHasTests(true)
      } else {
        setHasTests(false)
      }
    } catch (error) {
      console.error("Failed to load test data:", error)
      setHasTests(false)
    } finally {
      setLoading(false)
    }
  }

  const handleShare = () => {
    if (!latestTest) return

    // Format test context for LLM
    const testContext = `The user has completed a ${latestTest.test_name} assessment. 
Test Results:
- Score: ${latestTest.score}
- Severity Level: ${latestTest.severity_level}
- Test Type: ${latestTest.test_type}
- Date: ${new Date(latestTest.taken_at).toLocaleDateString()}

Please use this information to understand the user's current mental health condition and provide appropriate support. You don't need to ask about their condition as you already have this context.`

    onShare(testContext)
  }

  const handleTakeTest = () => {
    onClose()
    router.push("/diagnostic-test")
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          ) : hasTests && latestTest ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Brain className="text-purple-600 dark:text-purple-400" size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Share Test Results with Therapist?
                </h2>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Sharing your latest assessment results will help your therapist understand your current condition better and provide more personalized support.
              </p>

              {/* Latest Test Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {latestTest.test_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(latestTest.taken_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    latestTest.severity_level === "severe" || latestTest.severity_level === "extremely severe"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : latestTest.severity_level === "moderate"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                      : latestTest.severity_level === "mild"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  }`}>
                    {latestTest.severity_level}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Score:</span> {latestTest.score}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleShare}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  Share Results
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Skip
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <AlertCircle className="text-orange-600 dark:text-orange-400" size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  No Test Results Found
                </h2>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Taking a mental health assessment can help your therapist understand your condition better and provide more personalized support.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Benefits of sharing test results:</strong>
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Your therapist will understand your condition without asking</li>
                  <li>More personalized and relevant support</li>
                  <li>Better tracking of your progress over time</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleTakeTest}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Take Assessment
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Continue Without Test
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}



