import { MessageCircle, Mic2, Zap } from "lucide-react"

export function TherapyOptions() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Text Chat Option */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-white hover:shadow-xl transition cursor-pointer group">
        <div className="flex items-center justify-between mb-4">
          <MessageCircle size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Text Chat</h3>
        <p className="text-blue-100 mb-6">
          Chat with our AI companion
        </p>
        <button className="w-full bg-white text-blue-600 font-semibold py-3 rounded-lg hover:bg-blue-50 transition">
          Start Chat
        </button>
      </div>

      {/* Voice Call Option */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 text-white hover:shadow-xl transition cursor-pointer group">
        <div className="flex items-center justify-between mb-4">
          <Mic2 size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Voice Call</h3>
        <p className="text-purple-100 mb-6">
          Have a natural conversation
        </p>
        <button className="w-full bg-white text-purple-600 font-semibold py-3 rounded-lg hover:bg-purple-50 transition">
          Start Call
        </button>
      </div>

      {/* Quick Assessment */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-white hover:shadow-xl transition cursor-pointer group">
        <div className="flex items-center justify-between mb-4">
          <Zap size={32} className="group-hover:scale-110 transition" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Quick Check-in</h3>
        <p className="text-emerald-100 mb-6">A brief mood assessment</p>
        <button className="w-full bg-white text-emerald-600 font-semibold py-3 rounded-lg hover:bg-emerald-50 transition">
          Start Check-in
        </button>
      </div>
    </div>
  )
}
