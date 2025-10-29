import { MapPin, Phone, Star } from "lucide-react"

export function TherapistDirectory() {
  return (
    <div className="bg-white overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Find a Professional Therapist</h2>
        <p className="text-sm text-gray-600 mt-1">Connect with licensed mental health professionals in your area</p>
      </div>
      <div className="p-6 flex-1">
        <div className="text-center text-gray-500 py-8">
          <p>No therapists available</p>
          <p className="text-sm mt-2">Therapist directory will appear here</p>
        </div>
      </div>
      <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
        <button className="text-blue-600 font-semibold hover:text-blue-700 transition">View More Therapists</button>
      </div>
    </div>
  )
}
