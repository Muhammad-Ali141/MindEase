// "use client"

// import Link from "next/link"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { dict, useLanguage } from "@/lib/i18n"
// import { LanguageToggle } from "@/components/LanguageToggle"
// import { useEffect, useState } from "react"

// export default function HomePage() {
//   const lang = useLanguage()
//   const t = dict[lang]
//   const isUrdu = lang === "ur"
//   const [mounted, setMounted] = useState(false)

//   useEffect(() => {
//     setMounted(true)
//   }, [])

//   if (!mounted) {
//     return null
//   }

//   return (
//     <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-gray-900 dark:to-slate-800">
//       {/* Main Content */}
//       <main className="mx-auto max-w-6xl px-6 py-20">
//         <div className="text-center">
//           {/* Hero Section */}
//           <div className="mb-16">
//             <h1 
//               className={`mb-8 text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-7xl ${
//                 isUrdu ? 'font-urdu' : ''
//               }`}
//               dir={isUrdu ? "rtl" : "ltr"}
//               style={isUrdu ? { 
//                 fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                 lineHeight: '1.4',
//                 textAlign: 'center'
//               } : {}}
//             >
//               <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
//                 {t.welcomeTitle}
//               </span>
//             </h1>
//             <p 
//               className={`mx-auto max-w-3xl text-xl text-slate-600 dark:text-slate-300 sm:text-2xl leading-relaxed ${
//                 isUrdu ? 'font-urdu' : ''
//               }`}
//               dir={isUrdu ? "rtl" : "ltr"}
//               style={isUrdu ? { 
//                 fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                 lineHeight: '1.8',
//                 textAlign: 'center'
//               } : {}}
//             >
//               {t.welcomeSubtitle}
//             </p>
//           </div>

//           {/* Action Cards */}
//           <div className="grid gap-8 sm:grid-cols-2 lg:gap-12">
//             {/* Login Card */}
//             <div className="group">
//               <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
//                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
//                 <CardHeader className="relative text-center pb-6">
//                   <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
//                     <svg
//                       className="h-8 w-8 text-white"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2.5}
//                         d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
//                       />
//                     </svg>
//                   </div>
//                   <CardTitle 
//                     className={`text-2xl font-bold text-slate-800 dark:text-white ${
//                       isUrdu ? 'font-urdu' : ''
//                     }`}
//                     dir={isUrdu ? "rtl" : "ltr"}
//                     style={isUrdu ? { 
//                       fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                       lineHeight: '1.4'
//                     } : {}}
//                   >
//                     {t.login}
//                   </CardTitle>
//                   <CardDescription 
//                     className={`text-slate-600 dark:text-slate-300 ${
//                       isUrdu ? 'font-urdu' : ''
//                     }`}
//                     dir={isUrdu ? "rtl" : "ltr"}
//                     style={isUrdu ? { 
//                       fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                       lineHeight: '1.6'
//                     } : {}}
//                   >
//                     {t.signInDescription}
//                   </CardDescription>
//                 </CardHeader>
//                 <CardContent className="relative text-center pt-0">
//                   <Link href="/login">
//                     <Button 
//                       className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300" 
//                       size="lg"
//                     >
//                       {t.login}
//                     </Button>
//                   </Link>
//                 </CardContent>
//               </Card>
//             </div>

//             {/* Register Card */}
//             <div className="group">
//               <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
//                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
//                 <CardHeader className="relative text-center pb-6">
//                   <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
//                     <svg
//                       className="h-8 w-8 text-white"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2.5}
//                         d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
//                       />
//                     </svg>
//                   </div>
//                   <CardTitle 
//                     className={`text-2xl font-bold text-slate-800 dark:text-white ${
//                       isUrdu ? 'font-urdu' : ''
//                     }`}
//                     dir={isUrdu ? "rtl" : "ltr"}
//                     style={isUrdu ? { 
//                       fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                       lineHeight: '1.4'
//                     } : {}}
//                   >
//                     {t.register}
//                   </CardTitle>
//                   <CardDescription 
//                     className={`text-slate-600 dark:text-slate-300 ${
//                       isUrdu ? 'font-urdu' : ''
//                     }`}
//                     dir={isUrdu ? "rtl" : "ltr"}
//                     style={isUrdu ? { 
//                       fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                       lineHeight: '1.6'
//                     } : {}}
//                   >
//                     {t.signUpDescription}
//                   </CardDescription>
//                 </CardHeader>
//                 <CardContent className="relative text-center pt-0">
//                   <Link href="/register">
//                     <Button 
//                       className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-300" 
//                       size="lg"
//                     >
//                       {t.register}
//                     </Button>
//                   </Link>
//                 </CardContent>
//               </Card>
//             </div>
//           </div>

//           {/* Features Section */}
//           <div className="mt-24">
//             <h2 
//               className={`mb-12 text-3xl font-bold text-slate-800 dark:text-white ${
//                 isUrdu ? 'font-urdu' : ''
//               }`}
//               dir={isUrdu ? "rtl" : "ltr"}
//               style={isUrdu ? { 
//                 fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                 lineHeight: '1.4'
//               } : {}}
//             >
//               <span className="bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
//                 {t.whyChooseTitle}
//               </span>
//             </h2>
//             <div className="grid gap-8 sm:grid-cols-3">
//               <div className="group text-center hover:-translate-y-2 transition-all duration-300">
//                 <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg group-hover:scale-110 transition-all duration-300">
//                   <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 20 20">
//                     <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.828a4 4 0 00-5.656 0z" clipRule="evenodd" />
//                   </svg>
//                 </div>
//                 <h3 
//                   className={`mb-3 text-lg font-bold text-slate-800 dark:text-white ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.4'
//                   } : {}}
//                 >
//                   {t.personalizedCare}
//                 </h3>
//                 <p 
//                   className={`text-slate-600 dark:text-slate-300 ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.6'
//                   } : {}}
//                 >
//                   {t.personalizedCareDesc}
//                 </p>
//               </div>
              
//               <div className="group text-center hover:-translate-y-2 transition-all duration-300">
//                 <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg group-hover:scale-110 transition-all duration-300">
//                   <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 20 20">
//                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
//                   </svg>
//                 </div>
//                 <h3 
//                   className={`mb-3 text-lg font-bold text-slate-800 dark:text-white ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.4'
//                   } : {}}
//                 >
//                   {t.safeSecure}
//                 </h3>
//                 <p 
//                   className={`text-slate-600 dark:text-slate-300 ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.6'
//                   } : {}}
//                 >
//                   {t.safeSecureDesc}
//                 </p>
//               </div>
              
//               <div className="group text-center hover:-translate-y-2 transition-all duration-300">
//                 <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg group-hover:scale-110 transition-all duration-300">
//                   <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 20 20">
//                     <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
//                   </svg>
//                 </div>
//                 <h3 
//                   className={`mb-3 text-lg font-bold text-slate-800 dark:text-white ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.4'
//                   } : {}}
//                 >
//                   {t.support247}
//                 </h3>
//                 <p 
//                   className={`text-slate-600 dark:text-slate-300 ${
//                     isUrdu ? 'font-urdu' : ''
//                   }`}
//                   dir={isUrdu ? "rtl" : "ltr"}
//                   style={isUrdu ? { 
//                     fontFamily: "'Noto Nastaliq Urdu', 'Amiri', 'Scheherazade New', serif",
//                     lineHeight: '1.6'
//                   } : {}}
//                 >
//                   {t.support247Desc}
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }



// "use client"

// import Link from "next/link"
// import { motion } from "framer-motion"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { dict, useLanguage } from "@/lib/i18n"
// import { useEffect, useState } from "react"

// export default function HomePage() {
//   const lang = useLanguage()
//   const t = dict[lang]
//   const isUrdu = lang === "ur"
//   const [mounted, setMounted] = useState(false)

//   useEffect(() => setMounted(true), [])
//   if (!mounted) return null

//   return (
//     <div className="min-h-screen flex flex-col bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-gray-900 dark:to-slate-800 transition-all">

//       {/* ================= Hero Section ================= */}
//       <section className="relative isolate overflow-hidden">
//         {/* Background Glow */}
//         <div className="absolute inset-0 -z-10 opacity-40">
//           <svg
//             className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[70rem] w-[70rem] blur-3xl"
//             aria-hidden="true"
//           >
//             <defs>
//               <radialGradient id="gradient" cx="0" cy="0" r="1">
//                 <stop offset="0%" stopColor="#34d399" />
//                 <stop offset="100%" stopColor="#2563eb" />
//               </radialGradient>
//             </defs>
//             <circle cx="50%" cy="50%" r="50%" fill="url(#gradient)" />
//           </svg>
//         </div>

//         <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 text-center">
//           <motion.h1
//             initial={{ opacity: 0, y: 40 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 1 }}
//             className={`text-5xl sm:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white ${isUrdu ? "font-urdu" : ""}`}
//             dir={isUrdu ? "rtl" : "ltr"}
//           >
//             <span className="bg-gradient-to-r from-blue-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
//               {t.welcomeTitle}
//             </span>
//           </motion.h1>

//           <motion.p
//             initial={{ opacity: 0, y: 40 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 1.2 }}
//             className={`mt-6 text-lg sm:text-2xl text-slate-600 dark:text-slate-300 leading-relaxed ${isUrdu ? "font-urdu" : ""}`}
//             dir={isUrdu ? "rtl" : "ltr"}
//           >
//             {t.welcomeSubtitle}
//           </motion.p>

//           <motion.div
//             initial={{ opacity: 0, y: 40 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 1.4 }}
//             className="mt-10 flex justify-center gap-6 flex-wrap"
//           >
//             <Link href="/register">
//               <Button
//                 size="lg"
//                 className="rounded-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-indigo-700 text-white text-lg px-8 py-4 shadow-xl"
//               >
//                 {t.register}
//               </Button>
//             </Link>
//             <Link href="/login">
//               <Button
//                 size="lg"
//                 variant="outline"
//                 className="rounded-full border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-800 text-lg px-8 py-4"
//               >
//                 {t.login}
//               </Button>
//             </Link>
//           </motion.div>
//         </div>
//       </section>

//       {/* ================= Login / Register Cards ================= */}
//       <section className="relative mx-auto max-w-6xl px-6 py-16 grid gap-10 sm:grid-cols-2">

//         {/* Background Image Behind Cards */}
//         <div
//           className="absolute inset-0 -z-10 opacity-20 bg-cover bg-center"
//           style={{ backgroundImage: "url('/img1.jpg')" }}
//         ></div>

//         {[
//           {
//             iconColor: "from-blue-500 to-indigo-600",
//             link: "/login",
//             title: t.login,
//             desc: t.signInDescription,
//             btnColor: "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
//           },
//           {
//             iconColor: "from-emerald-500 to-teal-600",
//             link: "/register",
//             title: t.register,
//             desc: t.signUpDescription,
//             btnColor: "from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
//           },
//         ].map((card, i) => (
//           <motion.div
//             key={i}
//             initial={{ opacity: 0, y: 30 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             transition={{ delay: i * 0.2 }}
//           >
//             <Card className="relative overflow-hidden bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/30 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 rounded-3xl">
//               <CardHeader className="text-center pb-6">
//                 <div
//                   className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${card.iconColor} shadow-lg`}
//                 >
//                   <svg
//                     className="h-8 w-8 text-white"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     {i === 0 ? (
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2.5}
//                         d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
//                       />
//                     ) : (
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2.5}
//                         d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
//                       />
//                     )}
//                   </svg>
//                 </div>
//                 <CardTitle className={`text-2xl font-bold text-slate-800 dark:text-white ${isUrdu ? "font-urdu" : ""}`} dir={isUrdu ? "rtl" : "ltr"}>
//                   {card.title}
//                 </CardTitle>
//                 <CardDescription className={`text-slate-600 dark:text-slate-300 ${isUrdu ? "font-urdu" : ""}`} dir={isUrdu ? "rtl" : "ltr"}>
//                   {card.desc}
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="text-center">
//                 <Link href={card.link}>
//                   <Button
//                     size="lg"
//                     className={`w-full h-12 text-lg font-semibold text-white rounded-full bg-gradient-to-r ${card.btnColor} shadow-lg transition-all`}
//                   >
//                     {card.title}
//                   </Button>
//                 </Link>
//               </CardContent>
//             </Card>
//           </motion.div>
//         ))}
//       </section>

//       {/* ================= Why Choose Us ================= */}
//       <section className="mx-auto max-w-6xl px-6 py-24 text-center">
//         <h2
//           className={`mb-12 text-3xl font-bold text-slate-800 dark:text-white ${isUrdu ? "font-urdu" : ""}`}
//           dir={isUrdu ? "rtl" : "ltr"}
//         >
//           <span className="bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
//             {t.whyChooseTitle}
//           </span>
//         </h2>

//         <div className="grid gap-10 sm:grid-cols-3">
//           {[{ icon: "💬", title: t.personalizedCare, desc: t.personalizedCareDesc },
//             { icon: "🔒", title: t.safeSecure, desc: t.safeSecureDesc },
//             { icon: "⏰", title: t.support247, desc: t.support247Desc }].map((feature, i) => (
//             <motion.div
//               key={i}
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               transition={{ delay: i * 0.2 }}
//               className="p-8 rounded-3xl bg-white/70 dark:bg-slate-900/60 shadow-md hover:shadow-xl backdrop-blur-lg transition-all duration-300"
//             >
//               <div className="text-5xl mb-4">{feature.icon}</div>
//               <h3 className="text-2xl font-semibold text-slate-800 dark:text-white mb-3">
//                 {feature.title}
//               </h3>
//               <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
//                 {feature.desc}
//               </p>
//             </motion.div>
//           ))}
//         </div>
//       </section>

//       {/* ================= Footer ================= */}
//       <footer className="mt-auto border-t border-slate-200 dark:border-slate-700 py-12 text-center text-slate-600 dark:text-slate-400">
//         <p>© {new Date().getFullYear()} MindEase. {t.allRightsReserved}</p>
//         <div className="mt-4 flex justify-center gap-6 text-sm">
//           <Link href="/about" className="hover:underline">{t.aboutUs}</Link>
//           <Link href="/contact" className="hover:underline">{t.contact}</Link>
//           <Link href="/privacy" className="hover:underline">{t.privacy}</Link>
//         </div>
//       </footer>
//     </div>
//   )
// }
"use client"

import Link from "next/link"

export default function HomePage() {
  return (
    <div
      className="min-h-screen w-full bg-fixed bg-cover bg-center text-gray-800"
      style={{ backgroundImage: "url('/img1.jpg')" }}
    >
      {/* ===== OVERLAY (for readability) ===== */}
      <div className="bg-white/80 backdrop-blur-sm min-h-screen w-full">
        {/* ===== HEADER ===== */}
        <header className="fixed top-0 left-0 w-full bg-white/60 backdrop-blur-md flex justify-between items-center px-10 py-4 z-50 shadow-sm">
          <h1 className="text-2xl font-bold text-blue-600">MindEase</h1>
          <nav className="space-x-4">
            <Link
              href="/login"
              className="px-4 py-2 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </nav>
        </header>

        {/* ===== HERO SECTION ===== */}
        <section className="w-full h-screen flex flex-col items-center justify-center text-center text-blue-900 px-4">
          <div className="max-w-3xl mt-20">
            <h1 className="text-5xl font-extrabold mb-6 drop-shadow-md">
              Welcome to MindEase
            </h1>
            <p className="text-xl mb-8 drop-shadow-sm">
              Empowering your journey to emotional well-being and mental peace.
            </p>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg rounded-full font-semibold text-white shadow-lg"
            >
              Get Started
            </Link>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="w-full py-20 bg-white/90 text-center">
          <h2 className="text-4xl font-bold text-blue-600 mb-12">How It Works</h2>
          <div className="flex flex-col md:flex-row justify-center gap-12 px-10">
            <div>
              <h3 className="text-2xl font-semibold text-blue-600 mb-2">
                1. Take Assessment
              </h3>
              <p>
                Answer a few simple questions to help us understand your emotional needs.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-blue-600 mb-2">
                2. Get Matched
              </h3>
              <p>
                We connect you with the best-suited therapist based on your assessment.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-blue-600 mb-2">
                3. Start Healing
              </h3>
              <p>
                Begin your sessions and take the first step towards better mental health.
              </p>
            </div>
          </div>
        </section>

        {/* ===== HELP SECTION ===== */}
        <section className="w-full py-20 bg-blue-50/90 text-center">
          <h2 className="text-4xl font-bold text-blue-600 mb-10">
            We’re Here to Help People With
          </h2>
          <div className="flex flex-wrap justify-center gap-6 text-lg">
            {[
              "Anxiety",
              "Depression",
              "Stress",
              "Relationship Issues",
              "Low Self-Esteem",
              "Burnout",
            ].map((issue) => (
              <span
                key={issue}
                className="bg-white shadow-md rounded-full px-6 py-3 hover:bg-blue-100 transition"
              >
                {issue}
              </span>
            ))}
          </div>
        </section>

        {/* ===== WHY MINDEASE ===== */}
        <section className="w-full py-20 bg-white/90 text-center">
          <h2 className="text-4xl font-bold text-blue-600 mb-12">Why MindEase?</h2>
          <div className="grid md:grid-cols-3 gap-12 px-10">
            <div>
              <h3 className="text-2xl font-semibold mb-3">🧑‍⚕️ Expert Therapists</h3>
              <p>
                Licensed professionals with experience across diverse fields of mental
                health.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-3">💬 Confidential Sessions</h3>
              <p>
                Secure and private online sessions that prioritize your comfort and safety.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-3">⚡ Personalized Support</h3>
              <p>Therapy tailored to your individual goals and emotional journey.</p>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="w-full bg-blue-600 text-white text-center py-6">
          <p>© {new Date().getFullYear()} MindEase. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
