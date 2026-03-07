import fs from "fs"
import path from "path"
import https from "https"

const API_KEY = "AIzaSyAXv9GNSrWY4JwkSKYsaHaLdsUvA9BB5sQn"

const images = [
  {
    name: "feature-emotion",
    prompt: "Minimalist mental wellness phone interface, soft warm cream background, gentle chat bubbles with empathetic messages, warm amber and terracotta tones, clean modern UI design, professional product photography, soft natural lighting, no text"
  },
  {
    name: "feature-bilingual",
    prompt: "Elegant artistic split screen showing Urdu calligraphy script on left and English on right, warm golden paper texture background, cultural harmony, bilingual communication concept, soft bokeh, warm amber lighting, no harsh shadows"
  },
  {
    name: "feature-assessment",
    prompt: "Clean minimal wellness journal and mood tracking dashboard on warm wooden desk, soft paper texture, clinical health form, gentle mood chart with warm earth tone colors, peaceful therapeutic aesthetic, soft natural window light, top-down flat lay photography"
  },
  {
    name: "feature-memory",
    prompt: "Person sitting by warm sunlit window journaling in notebook, plants in background, peaceful mindful atmosphere, warm amber and cream tones, soft bokeh background, mental health reflection, cozy therapy session aesthetic"
  },
  {
    name: "hero-illustration",
    prompt: "Young person using a calming mental wellness app on smartphone, soft warm studio lighting, cream and amber background, serene expression, therapy and self-care concept, clean professional lifestyle photography, no text overlay"
  }
]

const outDir = path.join(process.cwd(), "public", "images", "features")
fs.mkdirSync(outDir, { recursive: true })

async function generateImage(item) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: item.prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] }
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${API_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (res) => {
      let data = ""
      res.on("data", chunk => data += chunk)
      res.on("end", () => {
        try {
          const json = JSON.parse(data)
          if (json.error) { reject(new Error(json.error.message)); return }
          const parts = json.candidates?.[0]?.content?.parts
          const imgPart = parts?.find(p => p.inlineData)
          if (!imgPart) { reject(new Error("No image in response: " + data.slice(0, 300))); return }
          const buf = Buffer.from(imgPart.inlineData.data, "base64")
          const ext = imgPart.inlineData.mimeType?.includes("png") ? "png" : "jpg"
          const outPath = path.join(outDir, `${item.name}.${ext}`)
          fs.writeFileSync(outPath, buf)
          resolve({ name: item.name, path: `/images/features/${item.name}.${ext}` })
        } catch(e) { reject(e) }
      })
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

console.log("Generating images via Gemini API...")
for (const item of images) {
  try {
    const result = await generateImage(item)
    console.log(`OK  ${result.name} -> ${result.path}`)
  } catch(e) {
    console.error(`ERR ${item.name}: ${e.message}`)
  }
}
console.log("Done.")
