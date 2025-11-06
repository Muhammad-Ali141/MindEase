import { CheckCircle2, Clock } from "lucide-react"

export function DiagnosticTests() {
  return (
    <div className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mental Health Assessments</h2>
      </div>
      <div className="p-6 flex-1">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>No assessments available</p>
          <p className="text-sm mt-2">Mental health assessments will appear here</p>
        </div>
      </div>
    </div>
  )
}
