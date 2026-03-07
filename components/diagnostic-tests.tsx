"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { 
  apiGetDiagnosticTestStatus, 
  apiGetDiagnosticTestHistory,
  type DiagnosticTestStatus,
  type TestHistoryItem
} from "@/lib/api"
import { CheckCircle2, Clock, Brain, AlertCircle, Heart, Smile, ArrowRight, Loader2 } from "lucide-react"

export function DiagnosticTests() {
  const router = useRouter()
  const { user } = useAuth()
  const [testStatus, setTestStatus] = useState<DiagnosticTestStatus | null>(null)
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadTestData()
    }
  }, [user?.id])

  const loadTestData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const [status, history] = await Promise.all([
        apiGetDiagnosticTestStatus(user.id),
        apiGetDiagnosticTestHistory(user.id)
      ])
      setTestStatus(status)
      setTestHistory(history.results)
    } catch (error) {
      console.error("Failed to load test data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleTakeTest = (testType: string) => {
    router.push(`/diagnostic-test/${testType}`)
  }

  const getTestInfo = (testType: string | null) => {
    if (!testType) return null

    const testInfoMap: Record<string, { name: string; icon: any; color: string; description: string }> = {
      "generic-screening": {
        name: "Generic Screening Test",
        icon: Brain,
        color: "from-purple-500 to-indigo-600",
        description: "A brief 8-question screening to identify your primary concern"
      },
      "phq9": {
        name: "PHQ-9 (Depression)",
        icon: Heart,
        color: "from-blue-500 to-blue-600",
        description: "Check how you've been feeling lately"
      },
      "gad7": {
        name: "GAD-7 (Anxiety)",
        icon: AlertCircle,
        color: "from-orange-500 to-orange-600",
        description: "See if you're feeling worried or on edge"
      },
      "pss10": {
        name: "PSS-10 (Stress)",
        icon: Brain,
        color: "from-red-500 to-red-600",
        description: "Find out how much stress you're feeling"
      },
      "mood_test": {
        name: "General Mood Assessment",
        icon: Smile,
        color: "from-green-500 to-green-600",
        description: "Get a quick look at your overall mood"
      }
    }

    return testInfoMap[testType] || null
  }

  if (loading) {
    return (
      <div
        data-tour-target="mental-health-assessments"
        className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
      >
        <div className="p-6 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mental Health Assessments</h2>
        </div>
        <div className="p-6 flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
        </div>
      </div>
    )
  }

  const availableTest = testStatus?.available_test
  const testInfo = getTestInfo(availableTest || null)
  const TestIcon = testInfo?.icon || Brain

  return (
    <div
      data-tour-target="mental-health-assessments"
      className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
    >
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mental Health Assessments</h2>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto space-y-4">
        {/* Available Test Card */}
        {availableTest && testInfo && (
          <div className={`bg-gradient-to-br ${testInfo.color} rounded-xl p-6 text-white shadow-lg`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <TestIcon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{testInfo.name}</h3>
                  <p className="text-sm text-white/90 mt-1">{testInfo.description}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleTakeTest(availableTest)}
              className="w-full mt-4 bg-white text-gray-900 font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              {testStatus?.generic_screening_completed ? "Take Daily Test" : "Start Screening"}
              <ArrowRight size={18} />
            </button>
            {testStatus?.generic_screening_completed && (
              <p className="text-xs text-white/80 mt-3 text-center">
                💡 One test per day helps us track your mood effectively
              </p>
            )}
          </div>
        )}

        {/* No Test Available - Test Already Taken Today */}
        {!availableTest && testStatus?.generic_screening_completed && (
          <div className="text-center py-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-4">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium text-gray-900 dark:text-white mb-2">
                Today's Assessment Complete! ✅
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                You've already completed your daily assessment today.
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mt-4">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>Why one test per day?</strong><br />
                  Taking one assessment daily helps us monitor your mood patterns more effectively and provide better insights into your mental health journey. This allows us to track changes over time and offer more personalized support. Check back tomorrow for your next assessment!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Test Available - No Screening Completed */}
        {!availableTest && !testStatus?.generic_screening_completed && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Complete your initial screening to get started</p>
            <p className="text-sm mt-2">Mental health assessments will appear here</p>
          </div>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Recent Assessments
            </h3>
            <div className="space-y-2">
              {testHistory.slice(0, 5).map((result) => {
                const resultTestInfo = getTestInfo(result.test_type)
                const ResultIcon = resultTestInfo?.icon || Brain
                const severityColors: Record<string, string> = {
                  minimal: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                  mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                  moderate: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                  severe: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                  "extremely severe": "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300"
                }

                return (
                  <div
                    key={result.result_id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {resultTestInfo && (
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${resultTestInfo.color} text-white`}>
                          <ResultIcon size={16} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {result.test_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(result.taken_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Score: {result.score}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${severityColors[result.severity_level] || severityColors.minimal}`}>
                      {result.severity_level}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!availableTest && !testStatus?.generic_screening_completed && testHistory.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>No assessments available</p>
            <p className="text-sm mt-2">Mental health assessments will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}
