import { MapPin, Phone, Star } from "lucide-react"

export function TherapistDirectory() {
  return (
    <div
      data-tour-target="find-therapist"
      className="bg-white dark:bg-slate-800 overflow-hidden h-full flex flex-col rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
    >
      <div className="p-6 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Find a Professional Therapist</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Connect with licensed mental health professionals in your area</p>
      </div>
      <div className="p-6 flex-1">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>No therapists available</p>
          <p className="text-sm mt-2">Therapist directory will appear here</p>
        </div>
      </div>
      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 text-center border-t border-gray-100 dark:border-slate-700">
        <button className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition">View More Therapists</button>
      </div>
    </div>
  )
}
