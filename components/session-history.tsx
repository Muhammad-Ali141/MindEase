import { ChevronRight, Download } from "lucide-react"

export function SessionHistory() {
  return (
    <div className="bg-white overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Recent Sessions</h2>
      </div>
      <div className="p-6 flex-1">
        <div className="text-center text-gray-500 py-8">
          <p>No recent sessions found</p>
          <p className="text-sm mt-2">Your session history will appear here</p>
        </div>
      </div>
      <div className="p-4 bg-gray-50 text-center">
        <button className="text-blue-600 font-semibold hover:text-blue-700 transition">View All Sessions</button>
      </div>
    </div>
  )
}
