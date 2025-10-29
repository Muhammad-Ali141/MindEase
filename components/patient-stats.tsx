import { TrendingUp } from "lucide-react"

export function PatientStats() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="bg-gray-900 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-2">Total Patients</p>
            <p className="text-5xl font-bold">56</p>
            <p className="text-gray-400 text-sm mt-2">this month</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
              <span className="text-gray-900 font-bold text-2xl">56</span>
            </div>
            <div className="bg-gray-800 px-3 py-1 rounded-full flex items-center gap-1">
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-green-400 text-sm font-semibold">+22.8%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 bg-green-100 rounded-3xl p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Patient Statistics</h3>
            <p className="text-sm text-gray-600">Month October</p>
          </div>
          <button className="bg-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-50">Weekly ▼</button>
        </div>

        <div className="relative h-48">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 20 150 Q 80 120 140 100 T 260 80 T 380 90" stroke="#22c55e" strokeWidth="3" fill="none" />
            <path d="M 20 150 Q 80 120 140 100 T 260 80 T 380 90 L 380 200 L 20 200 Z" fill="url(#chartGradient)" />
            <circle cx="140" cy="100" r="6" fill="#22c55e" />
            <circle cx="140" cy="100" r="12" fill="none" stroke="#22c55e" strokeWidth="2" />
          </svg>

          <div className="absolute top-8 left-1/3 bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-semibold">
            30% ↗
          </div>
        </div>
      </div>
    </div>
  )
}
