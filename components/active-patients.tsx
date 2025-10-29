import { Clock } from "lucide-react"

export function ActivePatients() {
  const patients = [
    {
      id: 1,
      name: "Jemma Linda",
      time: "09:00 - 09:30 AM",
      lastVisit: "Last visit 1 week ago",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jemma",
      visitedTime: "1 week ago",
    },
    {
      id: 2,
      name: "Andy John",
      time: "09:30 - 09:50 AM",
      lastVisit: "Last visit 1 week ago",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Andy",
      visitedTime: "1 week ago",
    },
    {
      id: 3,
      name: "Ariana Jamie",
      time: "09:50 - 10:00 AM",
      lastVisit: "Last visit 2 weeks ago",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ariana",
      visitedTime: "2 weeks ago",
    },
  ]

  return (
    <div className="space-y-3">
      {patients.map((patient, idx) => (
        <div key={patient.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition">
          <img src={patient.image || "/placeholder.svg"} alt={patient.name} className="w-12 h-12 rounded-full" />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{patient.name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={14} />
              <span>{patient.time}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Visited {patient.visitedTime}</p>
          </div>
          {idx === 1 && (
            <div className="bg-orange-100 px-3 py-1 rounded-full text-xs font-semibold text-orange-700">Break time</div>
          )}
        </div>
      ))}
    </div>
  )
}
