"use client"

import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Brain, Sparkles, TrendingUp, Clock, CheckCircle, Info, Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { apiSubmitDiagnosticTest, apiGetDiagnosticTestStatus } from "@/lib/api"

interface TestData {
  name: string
  scale: string[]
  questions: string[] | Array<{ q: string; domain?: string }>
}


export default function TestPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const testType = params?.testType as string

  const [testData, setTestData] = useState<TestData | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [testStatus, setTestStatus] = useState<any>(null)
  const [testAlreadyTaken, setTestAlreadyTaken] = useState(false)

  // Map test type to JSON file
  const getTestFile = (type: string) => {
    const fileMap: Record<string, string> = {
      "generic-screening": "/diagnosticTests/generic_screening.json",
      depression: "/diagnosticTests/phq9.json",
      anxiety: "/diagnosticTests/gad7.json",
      stress: "/diagnosticTests/pss10.json",
      "general-mood": "/diagnosticTests/mood_test.json",
      "mood_test": "/diagnosticTests/mood_test.json", // Backend returns this format
      "phq9": "/diagnosticTests/phq9.json", // Backend returns this format
      "gad7": "/diagnosticTests/gad7.json", // Backend returns this format
      "pss10": "/diagnosticTests/pss10.json" // Backend returns this format
    }
    return fileMap[type] || null
  }


  // Check test status and load test data
  useEffect(() => {
    const loadTestData = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      // First check if user can take this test
      try {
        const status = await apiGetDiagnosticTestStatus(user.id)
        setTestStatus(status)
        
        // Check if test is already taken today (for daily tests, not generic screening)
        if (testType !== "generic-screening") {
          // If no available test, it means test was already taken today
          if (!status.available_test) {
            setTestAlreadyTaken(true)
            setLoading(false)
            return
          }
          
          // Also check last_test_date as a backup
          if (status.last_test_date) {
            const lastTestDate = new Date(status.last_test_date)
            const today = new Date()
            // Reset time to compare only dates
            lastTestDate.setHours(0, 0, 0, 0)
            today.setHours(0, 0, 0, 0)
            
            if (lastTestDate.getTime() === today.getTime()) {
              setTestAlreadyTaken(true)
              setLoading(false)
              return
            }
          }
        }
      } catch (error) {
        console.error("Error checking test status:", error)
      }

      // Load test file
      const filePath = getTestFile(testType)
      if (!filePath) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(filePath)
        const data = await response.json()
        setTestData(data)
      } catch (error) {
        console.error("Error loading test data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadTestData()
  }, [testType, user?.id])

  const handleBack = () => {
    router.push("/dashboard")
  }

  const handleAnswer = (questionIndex: number, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }))
  }

  const handleSubmit = async () => {
    if (testAlreadyTaken) {
      alert("You have already completed a test today. Please come back tomorrow.")
      return
    }
    
    if (!testData || !user?.id || Object.keys(answers).length !== testData.questions.length) {
      return
    }

    try {
      setSubmitting(true)

      // Convert answers to string keys for API
      const answersForApi: Record<string, number> = {}
      Object.entries(answers).forEach(([key, value]) => {
        answersForApi[key.toString()] = value
      })

      // Submit to backend
      const result = await apiSubmitDiagnosticTest(
        user.id,
        testType,
        answersForApi
      )

      console.log("Test submitted successfully:", result)
      
      // Log detailed results for generic screening
      if (testType === "generic-screening" && result.domain_scores) {
        console.log("\n=== Generic Screening Results ===")
        console.log("Domain Scores:", result.domain_scores)
        console.log("Primary Condition:", result.primary_condition)
        console.log("Explanation:", result.explanation)
        console.log("Total Score:", result.score)
        console.log("Severity Level:", result.severity_level)
        console.log("=".repeat(40))
      }
      
      setSubmitted(true)
      
      // Redirect to dashboard after showing success message
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } catch (error) {
      console.error("Failed to submit test:", error)
      alert("Failed to submit test. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const allQuestionsAnswered = testData && Object.keys(answers).length === testData.questions.length
  const progressPercentage = testData 
    ? (Object.keys(answers).length / testData.questions.length) * 100 
    : 0

  // Note: Generic screening check is now handled by backend
  // Users will be redirected appropriately based on their status

  // Get color scheme based on test type
  const getTestColors = (type: string) => {
    const colors: Record<string, { gradient: string; bg: string; border: string; text: string }> = {
      depression: {
        gradient: "from-blue-500 via-blue-600 to-indigo-600",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-200 dark:border-blue-800/50",
        text: "text-blue-600 dark:text-blue-400"
      },
      anxiety: {
        gradient: "from-orange-500 via-orange-600 to-red-600",
        bg: "bg-orange-50 dark:bg-orange-900/20",
        border: "border-orange-200 dark:border-orange-800/50",
        text: "text-orange-600 dark:text-orange-400"
      },
      stress: {
        gradient: "from-red-500 via-red-600 to-rose-600",
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800/50",
        text: "text-red-600 dark:text-red-400"
      },
      "general-mood": {
        gradient: "from-green-500 via-emerald-600 to-teal-600",
        bg: "bg-green-50 dark:bg-green-900/20",
        border: "border-green-200 dark:border-green-800/50",
        text: "text-green-600 dark:text-green-400"
      },
      "generic-screening": {
        gradient: "from-purple-500 via-indigo-600 to-blue-600",
        bg: "bg-purple-50 dark:bg-purple-900/20",
        border: "border-purple-200 dark:border-purple-800/50",
        text: "text-purple-600 dark:text-purple-400"
      }
    }
    return colors[type] || colors.depression
  }

  const colors = getTestColors(testType)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Brain className="text-blue-600 dark:text-blue-400" size={48} />
            </motion.div>
            <p className="text-gray-600 dark:text-gray-400 text-lg">Loading your check-up...</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // Show message if test already taken today
  if (testAlreadyTaken && testType !== "generic-screening") {
    const getConditionName = (condition: string | null) => {
      const conditionMap: Record<string, string> = {
        "depression": "Depression",
        "anxiety": "Anxiety",
        "stress": "Stress",
        "general-mood": "General Mood"
      }
      return conditionMap[condition || ""] || "your condition"
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-8 transition-colors group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Back to Dashboard</span>
            </motion.button>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 mb-6">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Today's Assessment Complete! ✅
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You've already completed your daily assessment today.
              </p>
              
              {testStatus?.primary_condition && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Identified Condition:
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {getConditionName(testStatus.primary_condition)}
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mt-4">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>Why one test per day?</strong><br />
                  Taking one assessment daily helps us monitor your mood patterns more effectively and provide better insights into your mental health journey. This allows us to track changes over time and offer more personalized support. Check back tomorrow for your next assessment!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!testData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-red-600 dark:text-red-400">Test not found</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-2xl p-12 text-center relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6 shadow-lg">
                  <CheckCircle2 className="text-white" size={48} />
                </div>
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-gray-900 dark:text-white mb-4"
              >
                {testType === "generic-screening" 
                  ? "Screening Complete!" 
                  : "Thank you for completing the check-up!"}
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-gray-600 dark:text-gray-400 mb-8 text-lg"
              >
                {testType === "generic-screening" 
                  ? "Your primary concern has been identified and saved. You'll now see personalized daily assessments on your dashboard. Redirecting you now..."
                  : "Your daily assessment has been recorded. Taking one assessment per day helps us track your mood patterns effectively and provide better insights. Redirecting you to the dashboard..."}
              </motion.p>
              
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={() => router.push("/dashboard")}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold text-lg"
              >
                Go to Dashboard
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header />
      
      {/* Hero Section */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${colors.gradient} dark:from-slate-900 dark:via-slate-800 dark:to-slate-900`}>
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Floating orbs */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors group backdrop-blur-sm bg-white/10 px-4 py-2 rounded-lg border border-white/20"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Back to Dashboard</span>
          </motion.button>

          {/* Test Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg"
              >
                <Brain className="text-white" size={40} />
              </motion.div>
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  {testData.name}
                </h1>
                <div className="flex items-center gap-4 text-white/90 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>5-10 minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>{testData.questions.length} questions</span>
                  </div>
                  {testType === "generic-screening" && (
                    <div className="flex items-center gap-2 text-white/80 text-xs">
                      <Info size={14} />
                      <span>This will help us identify your primary concern</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-white/90 text-base leading-relaxed max-w-2xl">
              {testType === "generic-screening"
                ? "This quick screening will help us understand your primary concern. Answer honestly based on how you've been feeling recently."
                : "Please answer all questions based on how you've been feeling over the past 2 weeks. Be honest and take your time."}
            </p>
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/90 text-sm font-medium">Progress</span>
              <span className="text-white/90 text-sm font-semibold">
                {Object.keys(answers).length} / {testData.questions.length}
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r from-white/80 to-white rounded-full shadow-lg`}
              />
            </div>
          </motion.div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Scale Reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 mb-8 shadow-lg backdrop-blur-sm`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 ${colors.bg} rounded-lg border ${colors.border}`}>
              <Sparkles className={colors.text} size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Rating Scale
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {testData.scale.map((scaleItem, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group"
              >
                <div className={`text-2xl font-bold ${colors.text} mb-1 group-hover:scale-110 transition-transform`}>
                  {index}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {scaleItem.split("=")[1]?.trim()}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Questions */}
        <div className="space-y-6 mb-8">
          {testData.questions.map((question, questionIndex) => {
            const isAnswered = answers[questionIndex] !== undefined
            return (
              <motion.div
                key={questionIndex}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + questionIndex * 0.05, type: "spring", stiffness: 100 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border-2 transition-all ${
                  isAnswered 
                    ? `${colors.border} shadow-xl` 
                    : "border-gray-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-4 mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 + questionIndex * 0.05, type: "spring" }}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      isAnswered
                        ? `bg-gradient-to-br ${colors.gradient} text-white shadow-lg`
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {questionIndex + 1}
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex-1 leading-relaxed">
                    {typeof question === "string" ? question : question.q}
                  </h3>
                  {isAnswered && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className={`${colors.text}`}
                    >
                      <CheckCircle2 size={24} className="fill-current" />
                    </motion.div>
                  )}
                </div>
                
                {/* Answer Options */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {testData.scale.map((scaleItem, scaleIndex) => {
                    const isSelected = answers[questionIndex] === scaleIndex
                    return (
                      <motion.button
                        key={scaleIndex}
                        onClick={() => handleAnswer(questionIndex, scaleIndex)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`
                          relative px-4 py-4 rounded-xl border-2 transition-all text-sm font-medium overflow-hidden
                          ${
                            isSelected
                              ? `bg-gradient-to-br ${colors.gradient} text-white border-transparent shadow-lg ring-2 ring-offset-2 ${colors.text.replace('text-', 'ring-')}`
                              : "bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md"
                          }
                        `}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-1 right-1"
                          >
                            <CheckCircle2 size={16} className="text-white" />
                          </motion.div>
                        )}
                        <div className={`font-bold text-2xl mb-2 ${isSelected ? "text-white" : colors.text}`}>
                          {scaleIndex}
                        </div>
                        <div className={`text-xs leading-tight ${isSelected ? "text-white/90" : "text-gray-600 dark:text-gray-400"}`}>
                          {scaleItem.split("=")[1]?.trim()}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="sticky bottom-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 border-2 border-gray-200 dark:border-slate-700"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                <TrendingUp className={colors.text} size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {Object.keys(answers).length} of {testData.questions.length} questions answered
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {allQuestionsAnswered ? "Ready to submit!" : "Please answer all questions"}
                </div>
              </div>
            </div>
            <motion.button
              onClick={handleSubmit}
              disabled={!allQuestionsAnswered || submitting || testAlreadyTaken}
              whileHover={allQuestionsAnswered && !submitting && !testAlreadyTaken ? { scale: 1.05 } : {}}
              whileTap={allQuestionsAnswered && !submitting && !testAlreadyTaken ? { scale: 0.95 } : {}}
              className={`
                px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2
                ${
                  allQuestionsAnswered && !submitting
                    ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg hover:shadow-xl`
                    : "bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                }
              `}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {allQuestionsAnswered && (
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      ✨
                    </motion.span>
                  )}
                  Submit Check-up
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


