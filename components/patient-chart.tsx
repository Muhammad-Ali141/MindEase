export function PatientChart() {
  return (
    <div className="bg-green-100 rounded-3xl p-8">
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
  )
}
