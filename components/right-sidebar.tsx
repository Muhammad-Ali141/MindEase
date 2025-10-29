import { Send } from "lucide-react"

export function RightSidebar() {
  return (
    <div className="flex flex-col h-full gap-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 text-center">
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=JamesAnderson"
          alt="Dr. Anderson"
          className="w-20 h-20 rounded-full mx-auto mb-4"
        />
        <h3 className="font-bold text-gray-900">James Anderson!</h3>
        <p className="text-sm text-gray-500">Psychiatrist</p>
      </div>

      {/* Active Patients */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-white text-sm font-semibold mb-3">Active Patients</p>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=patient1"
              alt="patient"
              className="w-8 h-8 rounded-full border-2 border-gray-900"
            />
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=patient2"
              alt="patient"
              className="w-8 h-8 rounded-full border-2 border-gray-900"
            />
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=patient3"
              alt="patient"
              className="w-8 h-8 rounded-full border-2 border-gray-900"
            />
            <div className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-xs font-bold border-2 border-gray-900">
              +
            </div>
          </div>
        </div>
      </div>

      {/* Support Chat */}
      <div className="bg-white rounded-2xl p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">Support Chat</h4>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          <div className="flex items-start gap-2">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=AllenMoon"
              alt="Allen"
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div>
              <p className="text-xs font-semibold text-gray-900">Allen Moon</p>
              <div className="bg-gray-100 rounded-lg p-2 mt-1 max-w-xs">
                <p className="text-xs text-gray-700">Hello, Doctor! 👋</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-gray-900 text-white rounded-lg p-2 max-w-xs">
              <p className="text-xs">Hey are you? I have started my medication but I get weird headaches.</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=AllenMoon"
              alt="Allen"
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div>
              <p className="text-xs font-semibold text-gray-900">Allen - 02:12 ...</p>
              <div className="bg-gray-100 rounded-lg p-2 mt-1 max-w-xs">
                <p className="text-xs text-gray-700">
                  Hello, Allen! Dont worry! That is part of the medication effects.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-gray-900 text-white rounded-lg p-2 max-w-xs">
              <p className="text-xs">You will be okay soon.</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Anderson"
              alt="Anderson"
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div>
              <p className="text-xs font-semibold text-gray-900">Anderson - 02:33 ...</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-xs focus:outline-none"
          />
          <button className="bg-gray-900 text-white p-2 rounded-lg hover:bg-gray-800 transition">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
