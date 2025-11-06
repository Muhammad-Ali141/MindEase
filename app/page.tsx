"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { dict, useLanguage } from "@/lib/i18n"
import { LanguageToggle } from "@/components/LanguageToggle"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Heart, Shield, Clock, Users, MessageCircle, Brain, ArrowRight, Mic2, FileText, Sparkles, CheckCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function HomePage() {
  const lang = useLanguage()
  const t = dict[lang]
  const isUrdu = lang === "ur"
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-slate-950 dark:via-purple-950/20 dark:to-pink-950/20">
      
      {/* ================= HEADER ================= */}
      <motion.header 
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-purple-100 dark:border-purple-900/30 shadow-sm"
      >
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-purple-400 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative p-2 bg-purple-500 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Heart className="h-5 w-5 text-white fill-white" />
              </div>
            </motion.div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
              MindEase
            </span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:flex text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 hover:bg-purple-50 dark:hover:bg-purple-900/30">
                {t.login}
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl">
                {t.register}
              </Button>
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* ================= HERO SECTION ================= */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-32 pb-20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
              x: [0, -40, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
            className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-blue-200/30 to-cyan-200/30 rounded-full blur-3xl"
          />
          
          {/* Floating decorative elements */}
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-1/4 left-10 w-32 h-32 opacity-20"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="4,4" />
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: 0.5 }}
            className="absolute bottom-1/3 right-20 w-40 h-40 opacity-15"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M20,50 Q50,20 80,50 T20,50" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className={`${isUrdu ? "md:order-2" : ""}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-semibold border-2 border-purple-300 dark:border-purple-700">
                <Heart className="h-4 w-4 fill-purple-600" />
                {isUrdu ? "آن لائن تھراپی" : "ONLINE THERAPY"}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className={`text-6xl sm:text-7xl lg:text-8xl font-extrabold mb-6 leading-[1.1] ${isUrdu ? "font-urdu" : "font-sans"}`}
              dir={isUrdu ? "rtl" : "ltr"}
            >
              <span className="block" style={{ 
                background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #6d28d9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>
                {isUrdu ? "وہ مدد حاصل" : "Get"}<br />
                {isUrdu ? "کریں جو" : "the help"}<br />
                {isUrdu ? "آپ کو درکار ہے" : "you need"}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className={`text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-lg ${isUrdu ? "font-urdu" : ""}`}
              dir={isUrdu ? "rtl" : "ltr"}
            >
              {t.welcomeSubtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/register">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    size="lg" 
                    className="group bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-lg px-8 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-purple-800"
                  >
                    {t.register}
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/login">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="text-lg px-8 py-6 rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300"
                  >
                    {t.login}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Illustration Area */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className={`relative ${isUrdu ? "md:order-1" : ""}`}
          >
            <div className="relative">
              {/* Soft blue background shape with animation */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [6, 8, 6]
                }}
                transition={{ duration: 8, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-br from-sky-200/40 to-cyan-200/30 rounded-[60%] blur-3xl"
              />
              
              {/* Main illustration container */}
              <div className="relative w-full h-[600px] flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.6 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative z-10 w-full max-w-2xl"
                >
                  <motion.div
                    animate={{ 
                      y: [0, -15, 0],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{ 
                      duration: 6, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Image
                      src="/landingpage.png"
                      alt="Mental Health Illustration"
                      width={800}
                      height={600}
                      className="w-full h-auto object-contain drop-shadow-2xl"
                      priority
                    />
                  </motion.div>
                </motion.div>
              </div>
            </div>
            
            {/* Decorative elements with animation */}
            <motion.div
              animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
              transition={{ duration: 20, repeat: Infinity }}
              className="absolute top-10 left-10 w-20 h-20 opacity-10"
            >
              <Heart className="w-full h-full text-purple-600" fill="currentColor" />
            </motion.div>
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, delay: 1 }}
              className="absolute bottom-20 right-10 w-16 h-16 opacity-10"
            >
              <Brain className="w-full h-full text-pink-600" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= TRUST BADGES ================= */}
      <section className="py-12 px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-y border-purple-100 dark:border-purple-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-sm text-slate-600 dark:text-slate-400"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <Shield className="h-5 w-5 text-purple-600 group-hover:scale-125 transition-transform" />
              <span className="font-medium">Secure & Confidential</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <Users className="h-5 w-5 text-blue-600 group-hover:scale-125 transition-transform" />
              <span className="font-medium">Expert Support</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <Clock className="h-5 w-5 text-pink-600 group-hover:scale-125 transition-transform" />
              <span className="font-medium">Available 24/7</span>
            </motion.div>
          </motion.div>
          </div>
        </section>

      {/* ================= HOW IT WORKS SECTION ================= */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/10 dark:to-blue-950/10"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 
              className={`text-4xl sm:text-5xl font-bold mb-4 ${isUrdu ? "font-urdu" : ""}`}
              dir={isUrdu ? "rtl" : "ltr"}
            >
              {isUrdu ? "یہ کیسے کام کرتا ہے؟" : "How It Works"}
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              {isUrdu ? "صرف تین آسان مراحل میں شروع کریں" : "Get started in just three simple steps"}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                number: "01",
                title: isUrdu ? "تشخیص لیں" : "Take Assessment",
                desc: isUrdu ? "آپ کی جذباتی ضروریات کو سمجھنے میں مدد کے لیے کچھ سادہ سوالات کے جوابات دیں۔" : "Answer a few simple questions to help us understand your emotional needs.",
                icon: Brain,
                color: "from-purple-500 to-pink-600",
                delay: 0
              },
              {
                number: "02",
                title: isUrdu ? "رسائی حاصل کریں" : "Get Access",
                desc: isUrdu ? "ہم آپ کو ٹیکسٹ اور آواز کی بنیاد پر بات چیت کی سہولیات فراہم کرتے ہیں۔" : "We provide you with both text-based and voice-based communication options.",
                icon: MessageCircle,
                color: "from-blue-500 to-cyan-600",
                delay: 0.2
              },
              {
                number: "03",
                title: isUrdu ? "شفا شروع کریں" : "Start Healing",
                desc: isUrdu ? "اپنے سیشن شروع کریں اور بہتر ذہنی صحت کی طرف پہلا قدم اٹھائیں۔" : "Begin your sessions and take the first step towards better mental health.",
                icon: Heart,
                color: "from-emerald-500 to-teal-600",
                delay: 0.4
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: step.delay }}
                whileHover={{ scale: 1.05, y: -10 }}
                className="relative"
              >
                <div className="relative z-10 bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: step.delay }}
                    className={`absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center shadow-2xl text-3xl font-extrabold text-white drop-shadow-md`}
                  >
                    {step.number}
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${step.color} mb-6`}
                  >
                    <step.icon className="h-6 w-6 text-white" />
                  </motion.div>
                  
                  <h3 
                    className={`text-2xl font-bold mb-3 text-slate-900 dark:text-white ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {step.title}
              </h3>
                  
                  <p 
                    className={`text-slate-600 dark:text-slate-400 leading-relaxed ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {step.desc}
              </p>
            </div>
              </motion.div>
            ))}
            </div>
          </div>
        </section>

      {/* ================= FEATURES SECTION ================= */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 
              className={`text-4xl sm:text-5xl font-bold mb-4 ${isUrdu ? "font-urdu" : ""}`}
              dir={isUrdu ? "rtl" : "ltr"}
            >
              {t.whyChooseTitle}
          </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Heart,
                title: t.personalizedCare,
                desc: t.personalizedCareDesc,
                gradient: "from-pink-500 to-rose-600",
                bg: "bg-pink-50 dark:bg-pink-900/10"
              },
              {
                icon: Shield,
                title: t.safeSecure,
                desc: t.safeSecureDesc,
                gradient: "from-blue-500 to-indigo-600",
                bg: "bg-blue-50 dark:bg-blue-900/10"
              },
              {
                icon: Clock,
                title: t.support247,
                desc: t.support247Desc,
                gradient: "from-purple-500 to-purple-600",
                bg: "bg-purple-50 dark:bg-purple-900/10"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.2 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className={`group relative overflow-hidden rounded-3xl p-8 ${feature.bg} border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-500 hover:shadow-2xl`}
              >
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-lg mb-6`}
                  >
                    <feature.icon className="h-8 w-8 text-white" />
                  </motion.div>
                  
                  <h3 
                    className={`text-2xl font-bold mb-3 ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {feature.title}
                  </h3>
                  
                  <p 
                    className={`text-slate-600 dark:text-slate-400 leading-relaxed ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          </div>
        </section>

      {/* ================= COMMUNICATION OPTIONS ================= */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-5"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 
              className={`text-4xl sm:text-5xl font-bold mb-4 ${isUrdu ? "font-urdu" : ""}`}
              dir={isUrdu ? "rtl" : "ltr"}
            >
              {isUrdu ? "اپنے آرام کے مطابق بات کریں" : "Choose Your Preferred Communication"}
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              {isUrdu ? "ٹیکسٹ یا آواز کے ذریعے مدد حاصل کریں" : "Get support through text or voice"}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: MessageCircle,
                title: isUrdu ? "ٹیکسٹ چیٹ" : "Text Chat",
                desc: isUrdu ? "لکھ کر بات چیت کریں اور اپنے خیالات کو تحریری شکل میں شیئر کریں۔" : "Communicate through text and share your thoughts in writing.",
                gradient: "from-blue-500 to-indigo-600",
                bg: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20"
              },
              {
                icon: Mic2,
                title: isUrdu ? "وائس چیٹ" : "Voice Chat",
                desc: isUrdu ? "آواز کے ذریعے فوری گفتگو کریں اور اپنی بات بہتر طریقے سے اظہار کریں۔" : "Have real-time voice conversations and express yourself better.",
                gradient: "from-purple-500 to-pink-600",
                bg: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20"
              }
            ].map((option, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.2 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className={`${option.bg} rounded-3xl p-8 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-500 shadow-xl hover:shadow-2xl relative overflow-hidden group`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/20 to-transparent"></div>
                
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: -10 }}
                    className={`inline-flex p-5 rounded-2xl bg-gradient-to-br ${option.gradient} shadow-2xl mb-6`}
                  >
                    <option.icon className="h-10 w-10 text-white" />
                  </motion.div>
                  
                  <h3 
                    className={`text-3xl font-bold mb-3 ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {option.title}
                  </h3>
                  
                  <p 
                    className={`text-slate-600 dark:text-slate-400 leading-relaxed text-lg ${isUrdu ? "font-urdu" : ""}`}
                    dir={isUrdu ? "rtl" : "ltr"}
                  >
                    {option.desc}
                  </p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="mt-6"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
                      <CheckCircle className="h-5 w-5" />
                      <span>{isUrdu ? "آسان اور فوری" : "Easy & Quick"}</span>
            </div>
                  </motion.div>
            </div>
              </motion.div>
            ))}
            </div>
          </div>
        </section>

      {/* ================= CTA SECTION ================= */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-5"></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="h-16 w-16 mx-auto mb-6 text-purple-600 opacity-50" />
          </motion.div>

          <h2 
            className={`text-4xl sm:text-5xl font-bold mb-6 ${isUrdu ? "font-urdu" : ""}`}
            dir={isUrdu ? "rtl" : "ltr"}
          >
            {isUrdu ? "آج ہی اپنی ذہنی صحت کی سفر شروع کریں" : "Start Your Mental Wellness Journey Today"}
          </h2>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-lg px-8 py-6 rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 border-0"
                >
                  {t.register}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ================= FOOTER ================= */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-12 px-6 bg-slate-900 text-slate-400"
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Heart className="h-5 w-5 text-purple-400 fill-purple-400" />
            <span className="text-lg font-bold text-white">MindEase</span>
          </motion.div>
          <p className="text-sm mb-4">© {new Date().getFullYear()} MindEase. {t.allRightsReserved}</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/about" className="hover:text-white transition-colors">
              {t.aboutUs}
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              {t.contact}
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              {t.privacy}
            </Link>
      </div>
        </div>
      </motion.footer>
    </div>
  )
}
