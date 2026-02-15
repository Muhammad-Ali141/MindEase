import { clerkMiddleware } from "@clerk/nextjs/server"

// Run Clerk but don't require auth on any route; MindEase uses its own auth + optional Google via Clerk
export default clerkMiddleware()

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
