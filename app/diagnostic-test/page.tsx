"use client"

import { useRouter } from "next/navigation"
import { Brain, Heart, AlertCircle, Smile, ArrowLeft, Info, Clock, CheckCircle2, Sparkles } from "lucide-react"
import { Header } from "@/components/header"
import { motion } from "framer-motion"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { apiGetDiagnosticTestStatus } from "@/lib/api"

export default function DiagnosticTestPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [primaryCondition, setPrimaryCondition] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableTest, setAvailableTest] = useState<string | null>(null)

  // Get test status from backend and redirect to available test
  useEffect(() => {
    const loadTestStatus = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const status = await apiGetDiagnosticTestStatus(user.id)
        setPrimaryCondition(status.primary_condition)
        setAvailableTest(status.available_test)
        
        // If there's an available test, redirect to it
        if (status.available_test) {
          router.push(`/diagnostic-test/${status.available_test}`)
        }
      } catch (error) {
        console.error("Failed to load test status:", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadTestStatus()
  }, [user?.id, router])

  const handleTestSelect = (testType: string) => {
    // If no primary condition, redirect to generic screening
    if (!primaryCondition) {
      router.push("/diagnostic-test/generic-screening")
    } else {
      router.push(`/diagnostic-test/${testType}`)
    }
  }

  const handleStartScreening = () => {
    router.push("/diagnostic-test/generic-screening")
  }

  const handleBack = () => {
    router.push("/dashboard")
  }

  const testOptions = [
    {
      id: "depression",
      name: "Depression",
      testName: "PHQ-9",
      description: "Check how you've been feeling lately. This helps you see if you might be dealing with sadness or low mood that's affecting your daily life.",
      duration: "5-7 minutes",
      questions: 9,
      icon: Heart,
      gradient: "from-blue-500 to-blue-600 dark:from-blue-700/80 dark:to-blue-800/80",
      bgLight: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-300",
      borderColor: "border-blue-200 dark:border-blue-800/50"
    },
    {
      id: "anxiety",
      name: "Anxiety",
      testName: "GAD-7",
      description: "See if you're feeling worried, nervous, or on edge more than usual. This helps you understand if anxiety is affecting your day-to-day life.",
      duration: "3-5 minutes",
      questions: 7,
      icon: AlertCircle,
      gradient: "from-orange-500 to-orange-600 dark:from-orange-700/80 dark:to-orange-800/80",
      bgLight: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-300",
      borderColor: "border-orange-200 dark:border-orange-800/50"
    },
    {
      id: "stress",
      name: "Stress",
      testName: "PSS-10",
      description: "Find out how much stress you're feeling in your life right now. This helps you see if things feel overwhelming or hard to handle.",
      duration: "5-7 minutes",
      questions: 10,
      icon: Brain,
      gradient: "from-red-500 to-red-600 dark:from-red-700/80 dark:to-red-800/80",
      bgLight: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-300",
      borderColor: "border-red-200 dark:border-red-800/50"
    },
    {
      id: "general-mood",
      name: "General Mood",
      testName: "Mood Check",
      description: "Get a quick look at your overall mood and how you're feeling emotionally. This gives you a simple way to check in with yourself.",
      duration: "3-5 minutes",
      questions: 8,
      icon: Smile,
      gradient: "from-green-500 to-green-600 dark:from-green-700/80 dark:to-green-800/80",
      bgLight: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-300",
      borderColor: "border-green-200 dark:border-green-800/50"
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  // If primary condition exists, show only that test option
  if (primaryCondition) {
    const primaryTest = testOptions.find(test => test.id === primaryCondition)
    if (primaryTest) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <Header />
          
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 dark:from-blue-900 dark:via-purple-900 dark:to-indigo-900">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: '40px 40px'
              }}></div>
            </div>

            <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
              <motion.nav
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6"
              >
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
                >
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium text-sm">Back to Dashboard</span>
                </button>
              </motion.nav>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="max-w-4xl"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-white/90">Your Personalized Check-up</span>
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
                    className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg"
                  >
                    <Brain className="text-white" size={32} />
                  </motion.div>
                  <div className="flex-1">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                      Mental Health <span className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">Check-up</span>
                    </h1>
                  </div>
                </div>

                <p className="text-base text-white/90 leading-relaxed max-w-2xl mb-6">
                  Based on your initial screening, we've identified your primary concern. Complete this check-up to get detailed insights.
                </p>
              </motion.div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8 max-w-2xl mx-auto">
              {(() => {
                const TestIcon = primaryTest.icon
                return (
                  <div
                    className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${primaryTest.borderColor} shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group`}
                  >
                    <div className={`bg-gradient-to-br ${primaryTest.gradient} p-6 text-white`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                          <TestIcon size={32} className="group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium opacity-90 mb-1">{primaryTest.testName}</div>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <Clock size={14} />
                            <span>{primaryTest.duration}</span>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">{primaryTest.name} Check-up</h3>
                    </div>

                    <div className="p-6">
                      <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                        {primaryTest.description}
                      </p>

                      <div className={`${primaryTest.bgLight} rounded-lg p-4 mb-6 border ${primaryTest.borderColor}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <CheckCircle2 size={16} className={primaryTest.textColor} />
                            <span className="font-medium">{primaryTest.questions} Questions</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Clock size={16} className={primaryTest.textColor} />
                            <span className="font-medium">{primaryTest.duration}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTestSelect(primaryCondition)}
                        className={`w-full ${primaryTest.textColor} bg-white dark:bg-slate-700 border-2 ${primaryTest.borderColor} font-semibold py-3.5 px-6 rounded-lg hover:bg-opacity-90 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md`}
                      >
                        Begin Check-up
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>

            <motion.footer
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="py-12 px-6 bg-slate-900 text-slate-400 rounded-xl"
            >
              <div className="max-w-7xl mx-auto text-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex items-center justify-center gap-2 mb-4"
                >
                  <Heart className="h-5 w-5 text-purple-400 fill-purple-400" />
                  <span className="text-lg font-bold text-white">MindEase</span>
                </motion.div>
                <p className="text-sm mb-4">© {new Date().getFullYear()} MindEase. All rights reserved.</p>
                <div className="flex flex-wrap justify-center gap-6 text-sm">
                  <Link href="/about" className="hover:text-white transition-colors">
                    About Us
                  </Link>
                  <Link href="/contact" className="hover:text-white transition-colors">
                    Contact
                  </Link>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </motion.footer>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 dark:from-blue-900 dark:via-purple-900 dark:to-indigo-900">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Animated Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Breadcrumb Navigation */}
          <motion.nav
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium text-sm">Back to Dashboard</span>
            </button>
          </motion.nav>

          {/* Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-4xl"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-white/90">Trusted & Easy to Use</span>
            </div>

            {/* Main Heading */}
            <div className="flex items-start gap-3 mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
                className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl"
              >
                <Brain className="text-white" size={32} />
              </motion.div>
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
                  <span>Mental Health </span>
                  <span className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
                    Check-ups
                  </span>
                </h1>
                <p className="text-base text-white/90 leading-relaxed max-w-2xl">
                  Simple questions to help you understand how you're feeling. These quick check-ups can help you see your emotional well-being and track how you're doing over time.
                </p>
              </div>
            </div>

            {/* Stats/Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4 mt-4"
            >
              <div className="flex items-center gap-2 text-white/80">
                <CheckCircle2 size={18} className="text-green-300" />
                <span className="text-xs font-medium">Trusted by Professionals</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <CheckCircle2 size={18} className="text-green-300" />
                <span className="text-xs font-medium">Private & Safe</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <CheckCircle2 size={18} className="text-green-300" />
                <span className="text-xs font-medium">Takes 5-10 Minutes</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Info Banner */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg flex items-start gap-3">
          <Info className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900 dark:text-blue-200">
            <p className="font-semibold mb-1">Getting Started</p>
            <p className="text-blue-700 dark:text-blue-300">
              Begin with our quick screening test (6-8 questions) to identify your primary concern. Based on your responses, we'll guide you to the most relevant detailed check-up.
            </p>
          </div>
        </div>

        {/* Generic Screening Card - Prominent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 dark:from-purple-700/80 dark:to-indigo-800/80 rounded-2xl shadow-2xl overflow-hidden border-4 border-purple-300 dark:border-purple-600"
        >
          <div className="p-8 text-white">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full">
                  <Sparkles size={16} />
                  <span className="text-xs font-medium">Start Here</span>
                </div>
                <h2 className="text-3xl font-bold mb-3">Quick Screening Test</h2>
                <p className="text-purple-100 dark:text-purple-200/80 mb-4 text-lg leading-relaxed">
                  A brief 8-question screening to help us understand your primary concern. This takes just 3-5 minutes.
                </p>
                <div className="flex items-center gap-4 text-purple-100 dark:text-purple-200/80 text-sm mb-6">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>3-5 minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>8 questions</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30">
                <Brain size={48} />
              </div>
            </div>
            <button
              onClick={handleStartScreening}
              className="w-full sm:w-auto px-8 py-4 bg-white text-purple-600 dark:text-purple-700 font-bold rounded-xl hover:bg-purple-50 dark:hover:bg-purple-100 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 text-lg"
            >
              Start Screening →
            </button>
          </div>
        </motion.div>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-300 dark:bg-slate-700"></div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Or explore specific check-ups</span>
          <div className="flex-1 h-px bg-gray-300 dark:bg-slate-700"></div>
        </div>

        {/* Test Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {testOptions.map((test) => {
            const Icon = test.icon
            return (
              <div
                key={test.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${test.borderColor} shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group`}
              >
                {/* Card Header with Gradient */}
                <div className={`bg-gradient-to-br ${test.gradient} p-6 text-white`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Icon size={32} className="group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium opacity-90 mb-1">{test.testName}</div>
                      <div className="flex items-center gap-1 text-xs opacity-75">
                        <Clock size={14} />
                        <span>{test.duration}</span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{test.name} Check-up</h3>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                    {test.description}
                  </p>

                  {/* Test Details */}
                  <div className={`${test.bgLight} rounded-lg p-4 mb-6 border ${test.borderColor}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <CheckCircle2 size={16} className={test.textColor} />
                        <span className="font-medium">{test.questions} Questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Clock size={16} className={test.textColor} />
                        <span className="font-medium">{test.duration}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleTestSelect(test.id)}
                    className={`w-full ${test.textColor} bg-white dark:bg-slate-700 border-2 ${test.borderColor} font-semibold py-3.5 px-6 rounded-lg hover:bg-opacity-90 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md`}
                  >
                    Start Check-up
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-16 py-12 px-6 bg-slate-900 text-slate-400"
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Heart className="h-5 w-5 text-purple-400 fill-purple-400" />
            <span className="text-lg font-bold text-white">MindEase</span>
          </motion.div>
          <p className="text-sm mb-2">© {new Date().getFullYear()} MindEase. All rights reserved.</p>
          <p className="text-xs mb-4 text-slate-500">
            All assessments are confidential and your responses are securely stored.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/about" className="hover:text-white transition-colors">
              About Us
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}


