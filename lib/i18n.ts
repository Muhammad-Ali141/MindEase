"use client"

import { useSyncExternalStore } from "react"

export type Language = "en" | "ur"

// tiny external store for language with localStorage persistence
let currentLang: Language = "en"
const listeners = new Set<() => void>()

function readPersisted(): Language | null {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem("mindease_lang")
  return v === "en" || v === "ur" ? v : null
}

if (typeof window !== "undefined") {
  const persisted = readPersisted()
  if (persisted) currentLang = persisted
}

export function setLanguage(lang: Language) {
  currentLang = lang
  if (typeof window !== "undefined") {
    window.localStorage.setItem("mindease_lang", lang)
  }
  listeners.forEach((l) => l())
}

export function getLanguage(): Language {
  return currentLang
}

export function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage)
}

export const dict = {
  en: {
    loginTitle: "Welcome back",
    registerTitle: "Create your account",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    displayName: "Display name",
    preferredLanguage: "Preferred language",
    save: "Save",
    logout: "Logout",
    login: "Log in",
    register: "Register",
    or: "or",
    toLogin: "Already have an account?",
    toRegister: "Create one",
    successSaved: "Saved successfully",
    successAccount: "Account created. Please log in.",
    welcomeTitle: "Welcome to MindEase",
    welcomeSubtitle: "Your mental wellness companion. Take care of your mind, one step at a time.",
    signInDescription: "Sign in to your existing account",
    signUpDescription: "Create a new account to get started",
    whyChooseTitle: "Why Choose MindEase?",
    personalizedCare: "Personalized Care",
    personalizedCareDesc: "Tailored mental health support",
    safeSecure: "Safe & Secure",
    safeSecureDesc: "Your privacy is our priority",
    support247: "24/7 Support",
    support247Desc: "Always here when you need us",
    passwordRequirements: "Password must be 8-16 characters with numbers, letters, and special characters",
    passwordTooShort: "Password must be at least 8 characters",
    passwordTooLong: "Password must be no more than 16 characters",
    passwordNoNumbers: "Password must contain at least one number",
    passwordNoLetters: "Password must contain at least one letter",
    passwordNoSpecialChars: "Password must contain at least one special character",
    passwordLength: "8-16 characters",
    passwordNumbers: "At least 1 number",
    passwordLetters: "At least 1 letter",
    passwordSpecial: "At least 1 special character",
    allRightsReserved: "All rights reserved.",
    aboutUs: "About Us",
    contact: "Contact",
    privacy: "Privacy Policy",
    sendOtp: "Send OTP",
    verifyOtp: "Verify OTP",
    enterOtp: "Enter OTP",
    otpSent: "OTP Sent!",
    emailVerified: "Email Verified!",
    invalidOtp: "Invalid OTP",
    otpExpired: "OTP Expired",
    verifyEmailFirst: "Please verify your email first",
    otpSentSuccess: "OTP sent successfully. Please check your email.",
    otpVerifySuccess: "Email verified successfully!",
  },
  ur: {
    loginTitle: "خوش آمدید",
    registerTitle: "اکاؤنٹ بنائیں",
    email: "ای میل",
    password: "پاس ورڈ",
    confirmPassword: "پاس ورڈ دوبارہ",
    displayName: "نام",
    preferredLanguage: "پسندیدہ زبان",
    save: "محفوظ کریں",
    logout: "لاگ آؤٹ",
    login: "لاگ اِن",
    register: "رجسٹر",
    or: "یا",
    toLogin: "پہلے سے اکاؤنٹ موجود ہے؟",
    toRegister: "اکاؤنٹ بنائیں",
    successSaved: "کامیابی سے محفوظ ہوگیا",
    successAccount: "اکاؤنٹ بن گیا۔ براہِ کرم لاگ اِن کریں۔",
    welcomeTitle: "MindEase میں خوش آمدید",
    welcomeSubtitle: "ذہنی سکون کے سفر میں آپ کا پہلا قدم",
    signInDescription: "اپنے موجودہ اکاؤنٹ میں سائن اِن کریں",
    signUpDescription: "شروع کرنے کے لیے نیا اکاؤنٹ بنائیں",
    whyChooseTitle: "MindEase کیوں منتخب کریں؟",
    personalizedCare: "انفرادی نگہداشت",
    personalizedCareDesc: "آپ کی ذہنی صحت کے لیے خصوصی تعاون",
    safeSecure: "محفوظ اور قابلِ اعتماد",
    safeSecureDesc: "آپ کی رازداری ہماری اولین ترجیح ہے",
    support247: "24/7 سپورٹ",
    support247Desc: "جب آپ کو ہماری ضرورت ہو",
    passwordRequirements: "پاس ورڈ 8-16 حروف کا ہونا چاہیے جس میں نمبر، حروف اور خصوصی علامات شامل ہوں",
    passwordTooShort: "پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے",
    passwordTooLong: "پاس ورڈ زیادہ سے زیادہ 16 حروف کا ہونا چاہیے",
    passwordNoNumbers: "پاس ورڈ میں کم از کم ایک نمبر ہونا چاہیے",
    passwordNoLetters: "پاس ورڈ میں کم از کم ایک حرف ہونا چاہیے",
    passwordNoSpecialChars: "پاس ورڈ میں کم از کم ایک خصوصی علامت ہونی چاہیے",
    passwordLength: "8-16 حروف",
    passwordNumbers: "کم از کم 1 نمبر",
    passwordLetters: "کم از کم 1 حرف",
    passwordSpecial: "کم از کم 1 خصوصی علامت",
    allRightsReserved: "تمام حقوق محفوظ ہیں۔",
    aboutUs: "ہمارے بارے میں",
    contact: "رابطہ",
    privacy: "پرائیویسی پالیسی",
    sendOtp: "او ٹی پی بھیجیں",
    verifyOtp: "او ٹی پی کی تصدیق کریں",
    enterOtp: "او ٹی پی درج کریں",
    otpSent: "او ٹی پی بھیج دی گئی!",
    emailVerified: "ای میل تصدیق شدہ!",
    invalidOtp: "غلط او ٹی پی",
    otpExpired: "او ٹی پی کی میعاد ختم",
    verifyEmailFirst: "پہلے اپنا ای میل تصدیق کریں",
    otpSentSuccess: "او ٹی پی کامیابی سے بھیج دی گئی۔ براہ کرم اپنا ای میل چیک کریں۔",
    otpVerifySuccess: "ای میل کامیابی سے تصدیق شدہ!",
  },
} as const
