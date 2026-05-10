import { readFileSync } from "fs"

const KEY      = "bXVoYW1tYWRhbGl0YWhhMjVAZ21haWwuY29t:iOkkZUvj0ILgYVKN09hCE"
const IMG_PATH = process.argv[2]

if (!IMG_PATH) {
  console.error('Usage: node scripts/upload-did-image.mjs "path/to/image.jpg"')
  process.exit(1)
}

console.log("Uploading image to D-ID...")

const bytes = readFileSync(IMG_PATH)
const form  = new FormData()
form.append("image", new Blob([bytes], { type: "image/jpeg" }), "avatar.jpg")

const res  = await fetch("https://api.d-id.com/images", {
  method:  "POST",
  headers: { Authorization: `Basic ${KEY}` },
  body:    form,
})
const data = await res.json()
console.log("Status:", res.status)
console.log("Response:", JSON.stringify(data, null, 2))

if (data.url) {
  console.log("\n✅ Add this to .env.local:")
  console.log(`NEXT_PUBLIC_DID_SOURCE_URL=${data.url}`)
} else {
  console.error("\n❌ Upload failed — check response above")
}
