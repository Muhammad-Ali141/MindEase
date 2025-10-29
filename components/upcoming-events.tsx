import { Clock } from "lucide-react"

export function UpcomingEvents() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900">Team Meeting</h4>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <Clock size={16} />
              <span>09:00 - 09:30 AM</span>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <span className="text-gray-400">⋮</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1"
              alt="user"
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=user2"
              alt="user"
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=user3"
              alt="user"
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold border-2 border-white">
              2+
            </div>
          </div>
          <button className="ml-2 p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
            <span className="text-gray-600">→</span>
          </button>
        </div>
      </div>

      <div className="bg-orange-100 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Consultation</h4>
            <div className="text-3xl font-bold text-gray-900 mt-2">10/40</div>
            <p className="text-sm text-gray-600 mt-1">20%</p>
          </div>
          <div className="w-24 h-24 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#f97316"
                strokeWidth="8"
                strokeDasharray={`${(20 / 100) * 282.7} 282.7`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="55" textAnchor="middle" className="text-sm font-bold fill-gray-900">
                20%
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
