import { TrendingUp, Calendar, Award } from "lucide-react"

export function QuickStats() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Sessions Completed */}
      <div className="bg-white p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 font-semibold">Sessions Completed</h3>
          <Calendar size={20} className="text-blue-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">-</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">No data available</p>
      </div>

      {/* Mood Trend */}
      <div className="bg-white p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 font-semibold">Mood Trend</h3>
          <TrendingUp size={20} className="text-purple-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">-</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">No data available</p>
      </div>

      {/* Streak */}
      <div className="bg-white p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-600 font-semibold">Current Streak</h3>
          <Award size={20} className="text-amber-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">-</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">No data available</p>
      </div>
    </div>
  )
}
