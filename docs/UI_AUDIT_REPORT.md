# MindEase — Full UI/UX Audit
**Lens:** Multilingual interface quality, RTL fidelity, Urdu nativeness, premium emotional tone.
**Date:** 2026-04-16
**Method:** Live exploration of public + auth screens at `localhost:3000`. Auth-protected screens audited from source (`B:/Uni/FYP/Implementation/MindEase/MindEase`) since I could not authenticate as the user.

> The English experience is genuinely beautiful — warm desaturated palette, restrained serif/sans pairing, confident hierarchy. The Urdu experience, by contrast, feels like a translation layer bolted on top of an LTR app. The fixes below are mostly architectural and unlock a much more native feel without redesigning anything.

---

## Top systemic issues (highest leverage)

### 1. Pre-auth screens never go RTL — even when "Urdu" is selected
**Verified at runtime.** On `/`, `/auth`, `/auth?mode=signup`, even with `localStorage.mindease_lang = "ur"` and Urdu text rendering on screen, the document state is:

```
html.lang        = "en"
direction        = ltr
body font-family = __DM_Sans
```

Why: `LangSync` (`components/lang-sync.tsx`) only writes `html[lang]` from **`useProfileLanguage()`**, which reads `user.lang_pref` from the auth context. Pre-auth there is no user, so it falls back to `"en"` and `html[lang="ur"]` CSS rules in `globals.css` (which contain ALL the RTL flipping + font swaps) never activate.

Meanwhile `LanguageToggle` writes to `localStorage.mindease_lang` and the form components read that via `useLanguage()` to swap their strings. So on the marketing site you end up with: **Urdu glyphs rendered in DM Sans (fallback to system Naskh) inside an LTR layout.** That's the worst of both worlds.

**Fix:** In `LangSync`, prefer `useLanguage()` over `useProfileLanguage()` while logged-out, and write **both** `lang` and `dir` (`document.documentElement.dir = lang === "ur" ? "rtl" : "ltr"`). Once logged in, sync the two stores so toggling the header language pill updates `user.lang_pref` AND the `mindease_lang` localStorage atomically.

### 2. The landing page language toggle is broken
Clicking `UR` on `/` throws:

```
Uncaught Error: Module [project]/lib/i18n.ts ... was instantiated because it was required
from module [project]/components/LanguageToggle.tsx, but the module factory is not available.
```

This is reproducible across hard reloads, not just HMR. The dynamic `import("@/lib/i18n")` inside `setLang` in `LanguageToggle.tsx:9` never resolves. Result: a visitor cannot change language until they sign up — the bilingual promise on the hero page can't be tested.

**Fix:** Drop the dynamic import. `setLanguage` is a tiny function — import it eagerly:
```tsx
import { useLanguage, setLanguage } from "@/lib/i18n"
// ...
const setLang = (l: "en" | "ur") => setLanguage(l)
```

### 3. Urdu fonts loaded but never used pre-auth
`app/layout.tsx` loads `Noto_Nastaliq_Urdu`, `Noto_Sans_Arabic`, and `Amiri`. Beautiful choices. But the activation rule is `html[lang="ur"] { --font-dm-sans: var(--font-noto-arabic); ... }` — and per finding #1, `html[lang]` never becomes `"ur"` on the marketing site. So Urdu text on the auth/landing pages is rendered by **whatever Arabic-script fallback the OS picks** (on Windows: Segoe UI Naskh-style). Compare the screenshot quality of the Urdu auth page to what Noto Sans Arabic would actually render — there's a meaningful loss of polish.

Also worth deciding: **Naskh vs Nastaliq.** Currently the `body` font for Urdu maps to Noto Sans Arabic (Naskh). The comment in `layout.tsx:37` says *"Clean modern Arabic-script sans — much more readable at UI sizes than Nastaliq."* That's defensible for body text and dense UI, but for the **emotional, "reading" surfaces** of a mental-health app — long AI replies, journal entries, hero headlines — Nastaliq carries the right cultural weight. A Pakistani user opening this app expects to see Nastaliq; Naskh reads as Arabic, not Urdu. A two-tier system (Nastaliq for headings + display + AI replies, Naskh-sans for chrome/labels) would feel native instead of utilitarian.

### 4. `String.replace(/ /g, "\n")` breaks Urdu layout on the dashboard's primary cards
In `components/therapy-options.tsx:38, 52, 66`:
```tsx
title: t.quickCheckin.replace(/ /g, "\n"),
```

Splitting on spaces happens to give a 2-line title in English ("Quick Check-in" → 2 lines). In Urdu:
- `t.quickCheckin` = `"فوری چیک ان"` — **3 words → 3 lines**, while the other two cards stay at 2 lines.

Result: the three primary action cards have unequal heights in Urdu, breaking the grid rhythm on the most important surface of the app.

**Fix:** Don't do typographic line-breaking via string mutation. Use CSS — `max-width` + `overflow-wrap` — or define explicit `titleEn` / `titleUr` per card with intended line breaks (`\u200B` or a real `\n`).

### 5. RTL-unsafe layout primitives across components
Source-level scan. None of these flip when `direction: rtl` is applied:
- `components/sidebar.tsx`: `borderRight` on the sidebar edge (line 93), `borderLeft` for active nav indicator (line 193), `textAlign: "left"` (line 197), and `<ChevronLeft>` / `<ChevronRight>` collapse glyphs that don't reverse for RTL.
- `components/chat-message.tsx`: bubble corner radii are absolute (`"16px 4px 4px 16px"`, `"4px 16px 16px 4px"`). The "tail" on the speech bubble points the wrong way in RTL — user bubble's tail visually contradicts the avatar position once flex-direction reverses. Also `marginLeft: 2` on the typing caret.
- `components/AppShell.tsx`: minor — uses Tailwind which mostly handles RTL through logical props if configured, but inline styles in this file are fine.
- The hero/auth two-column layouts mirror correctly **once** `direction: rtl` is applied (verified in code), but you can't see this today because of finding #1.

**Fix:** Replace `left`/`right` physical properties with logical equivalents (`inset-inline-start`, `border-inline-start`, `padding-inline-end`). For sidebar chevrons, swap based on `useProfileLanguage()`. For chat bubbles, compute corner radii from `dir`.

### 6. Date formatting is hard-coded to en-US
`components/header.tsx:75`:
```tsx
new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
```
Header date chip will say "Thu, Apr 16" even when the rest of the dashboard is in Urdu. Same pattern likely in session history.
**Fix:** Pass the active language: `lang === "ur" ? "ur-PK" : "en-US"`.

### 7. Latin tokens leaking into Urdu lines
On the auth side panel feature list: `AI معالج`. The "AI" Latin glyphs sit in the middle of an RTL line with no visual cue that they're meant to be intentional. Either fully transliterate (`اے آئی معالج`), set the Latin token in a slightly different weight/color so it reads as a proper noun, or wrap it in a styled `<span dir="ltr" class="latin-token">` so it has its own typographic context.

### 8. Footer links 404
`/about`, `/contact`, `/privacy` (linked from footer on every public page) all return Next's default 404 page — black background, "404 / This page could not be found." For a wellness brand, this is the first emotional break: the visitor goes from your warm dark palette to a stark black void. Either wire these pages, or remove the footer links until they exist.

---

## Per-screen findings

### Marketing landing — `/` (English)
Screenshots: `01a-landing-en-hero.png` through `01e-landing-en-cta.png`.

**What works:**
- The hero is genuinely strong — Cormorant Garamond at scale, italic on `you.` as the emotional accent, restrained metadata above ("AI-POWERED THERAPY"), warm dark earth palette. The chat-product mockup beside it does the job of an explainer without a single line of copy.
- "Two ways to be heard" — the green Voice Chat card alongside the cream Text Chat card creates real visual rhythm. The "Available now" / "Real-time voice" pills add useful state hierarchy.
- "Start your journey in three steps" — the oversized numerals (`01`, `02`, `03`) sit beautifully behind the icon + heading. This is the kind of detail that lifts the whole page from "good template" to "designed."
- The CTA section's color flip (warm beige block on dark) gives the page a confident close.

**What to refine:**
- The features section ("Everything you need…") has a problem at first paint: the right-side mockup card is positioned to align with feature #2 (Emotion-aware), but the eye lands on feature #1 (Bilingual support). The mismatch reads as a layout error until you scroll. Either wire the mockup to the **first** card on initial render, or animate it in only after a scroll-progress threshold so the user is primed for the reveal.
- The empty vertical space between the hero and the features section (visible in the full-page screenshot) is enormous on a 1440×900 viewport. This is a scroll-reveal animation that doesn't fire when the page is mounted at scrollY=0 — fine in real UX, ugly when shared via screenshot or printed. Add `whileInView` with `once: true` and an initial `opacity: 0.05` floor so static captures still show structure.
- "10k+ Sessions completed / 2 Languages supported" — these stat blocks are present in the DOM but invisible in the screenshot for the same reason. If the stats are real, surface them; if they're aspirational, remove them.

### Marketing landing — `/` (Urdu)
**Cannot be tested** — see systemic finding #2. The toggle throws on click. Once fixed, expect the same RTL audit applies: hero h1 needs an explicit Urdu line-break point ("ذہنی صحت\nآپ کے لیے بنائی گئی۔" or similar), the italic display accent (`you.` → `آپ`) doesn't translate aesthetically since Urdu has no italic convention — drop the italic and reach for a slightly lighter Nastaliq weight or a color shift instead.

### Auth — `/auth` (English)
Screenshot: `02-auth-en.png`.

**What works:**
- The two-panel split is a clean pattern. The green ambient panel on the left does emotional work; the form panel on the right is functional and clean.
- "Your sanctuary awaits you." is on-brand and emotionally honest for a mental-health product.
- The trust strip ("Private & secure / AI-powered / Bilingual") at the bottom of the welcome panel is a smart conversion lever.

**What to refine:**
- The welcome panel's vertical rhythm is loose — there's a gap between "Continue your mental wellness journey" and the trust list. Either close the gap or add a horizontal divider to make the gap intentional.
- The "Sign in" CTA is the only warm-cream surface on a dark form. It's prominent, but it also reads slightly muddy against the dark form background — consider an inner subtle border for more crispness.
- Email/password labels in all-caps + small size feel slightly utilitarian for an otherwise emotional product. Consider Title Case + a touch more weight.

### Auth — `/auth` (Urdu)
Screenshot: `02b-auth-ur.png`. **This is the most revealing screen for the audit.**

**Critical issues:**
- **Layout did not mirror.** Welcome panel is still on the LEFT visually, form on the RIGHT — same as English. In a properly RTL-flipped layout, the form panel would be on the LEFT and the welcome panel on the RIGHT, mirroring the visual reading flow. (Root cause = systemic #1.)
- **Concentric decorative circles did not mirror.** They still anchor bottom-left in EN and stay bottom-left in UR. They should anchor bottom-right when in RTL.
- **Heading line-break is awkward.** "آپ کا محفوظ مقام\nمنتظر ہے۔" breaks after "مقام" — but Urdu readers parse "محفوظ مقام منتظر ہے" as a single semantic unit; the break interrupts the phrase. Better: "آپ کا محفوظ مقام\nآپ کا منتظر ہے۔" or set a wider `max-width` so the line stays whole.
- **Font fallback.** The Urdu glyphs visible are not Noto Nastaliq Urdu / Noto Sans Arabic / Amiri — they're Windows system fallback (looks like Segoe UI Naskh). Tested via `getComputedStyle` — body font is still `__DM_Sans`. (Root cause = systemic #3.)
- **Mixed-script tokens in trust list.** "AI معالج" — "AI" sits in the middle of an RTL line with no visual treatment. Reads as untranslated. (See systemic #7.)
- **EN/UR pill order.** The pill is `[EN][UR]` left-to-right. In RTL the pill should also flip to `[UR][EN]` so the active language sits in the natural-leading position. Today the active "UR" pill with cream highlight ends up on the visual right, which feels acceptable, but the order itself doesn't reflect RTL.
- **Welcome panel and form panel vertical alignment is off.** Form is significantly taller than the welcome panel; the panel boundary is visible mid-card. Use `align-items: stretch` and a min-height anchor.

### Auth — `/auth?mode=signup` (Urdu)
Screenshot: `02c-signup-ur.png`.

- All findings from the login UR view apply.
- "ذہنی صحت کا سفر یہاں سے شروع ہو۔" is a beautiful translation of "Healing starts here." Clean and emotionally appropriate.
- "اوٹی پی بھیجیں" — "Send OTP". Urdu speakers would more often say "پن بھیجیں" or "کوڈ بھیجیں". "OTP" transliterated as "اوٹی پی" reads technical and a bit awkward. Consider "تصدیقی کوڈ بھیجیں" (send verification code).
- The "Send OTP" button is positioned to the LEFT of the email input — but this layout is being preserved from EN. In RTL it should be on the right of the field.

### Auth — `/auth?mode=signup` (English)
Screenshot: `02d-signup-en.png`. Reads cleanly. The "Send OTP" CTA doesn't quite match the typographic weight of the surrounding chrome — feels like a stand-in. Style it as a tertiary action (text-only or ghost button) so the primary "Create account" remains the visual anchor.

### Dashboard — `/dashboard` (cannot reach interactively, source-level audit)
- Layout: `Sidebar | Main` with `Header` on top of main, then `TherapyOptions` (3 cards), `QuickStats` (3 cards), `[SessionHistory | DiagnosticTests]` (2-col grid), `TherapistDirectory`. Solid information architecture for a wellness app.
- Sidebar uses inline-styled physical positioning (see systemic #5) — the entire sidebar is on the LEFT in both EN and UR with no logic to flip. In RTL the sidebar should sit on the RIGHT and the chevrons should reverse.
- `TherapyOptions` cards: see systemic #4 — Quick Check-in card breaks to 3 lines in Urdu while the other two stay at 2.
- Header date chip: see systemic #6 — "Thu, Apr 16" doesn't localize.
- Header greeting maps to `goodMorning` / `goodAfternoon` / `goodEvening` from the dict, which is good. But greeting + first name is rendered as `[greeting], [first_name]` — for Urdu, the user's name could be in Latin script (e.g. "Hasnain") which then sits inside an Urdu line. Wrap user names in `<bdi>` to give them their own directional context.
- The dashboard gets `BeamsBackground` ambient lighting — nice touch; verify in Urdu mode the beams aren't anchored to a physical side that contradicts the flipped layout.

### Chat — `/chat` (source-level)
- `chat-interface.tsx` welcome state: heading is `t.chatWhatsOnMind {first_name}?` — the trailing `?` will render at the wrong position in Urdu (Urdu uses no Latin question mark; use "؟" or remove). Same risk for hyphens, quotes, em-dashes anywhere in the dict.
- Chat bubble shapes hard-coded LTR (see systemic #5). Once you flip RTL, user bubbles will appear on the LEFT (correct) but the speech-bubble corner cut will be on the wrong side.
- Suggestion chips read as a `flex-wrap: wrap` row — flexbox handles RTL natively if `direction: rtl` is set on a parent, so this should just work once the document direction is right.
- Streaming caret is `|` rendered with `marginLeft: 2`. In RTL the caret should appear on the LEFT of the text (where new characters arrive), with `marginRight`. Use `margin-inline-start`.
- The empty-state heading uses Cormorant Garamond — in Urdu mode this swaps to Amiri. Amiri is a good choice for emotional headings; verify the size/leading still feels right (Amiri's x-height differs from Cormorant).

### Profile — `/profile` (source-level)
- Major-city suggestions are hard-coded as English Latin: `["Islamabad", "Lahore", "Karachi", "Multan", "Peshawar", "Faisalabad"]`. For an Urdu user this is a pure-Latin chip strip inside an otherwise RTL form — visually jarring. Provide Urdu equivalents (`["اسلام آباد", "لاہور", ...]`) wired to the same value.
- Date input uses native `input[type=date]` — its UI is locale-controlled by the browser, not by the app. On a Pakistani user's Chrome it'll likely render in English. Acceptable trade-off but worth knowing.

### Diagnostic tests — `/diagnostic-test` (source-level)
- The test names map (`getTestInfo`) uses `t.phq9Depression`, etc. Good — strings are translated.
- The severity labels are keyed on lowercase English strings (`"minimal"`, `"mild"`, `"moderate"`, …). The dict won't be hit if the API returns Urdu severity labels. Keep the API enum stable in English and translate at the rendering layer.

### 404 page — `/about`, `/contact`, `/privacy`
Default Next.js 404 — black on black, "This page could not be found." Off-brand. Build a custom 404 that uses your palette and tone of voice ("یہ صفحہ نہیں ملا" / "This page can't be found, but your peace is just one tap away.")

---

## Quick visual nits worth fixing
- Hero `you.` italic Cormorant accent is a signature move — make sure it has an Urdu equivalent that isn't *just* italicizing Amiri (italic Nastaliq/Naskh is awkward). Consider a slightly larger weight + accent color instead.
- Auth "Continue with Google" Google logo is a vertically-stretched square, not the official asset. Use the official Google "G" mark.
- Footer wordmark is repeated three times on the homepage in different weights — converge on one.
- The dark-mode toggle (sun icon) is the same color as the EN/UR toggle — group them inside a single styled control or move them apart so they don't read as a grid.

---

## What I couldn't audit
I couldn't sign in (no test account; would not trigger an OTP to your real email without permission). The auth-protected screens above are audited from source — accurate for layout/i18n/RTL findings, but I couldn't verify rendering, font swaps post-login, animation timing, or interaction states (hover, focus, keyboard nav). If you want a deeper authenticated pass, drop a test account in chat and I'll go through each screen visually in both languages.

---

## Recommended priority order
1. **Fix #1 + #2 + #3 together** — they're three faces of the same problem and unlock real Urdu testing.
2. **Fix #4** (the dashboard card line-break bug) — visible regression on the most important surface.
3. **Fix #5** (RTL-safe primitives) systematically by introducing `border-inline-start` etc. — pays off across every screen.
4. **Fix #6, #7, #8** — small, high-polish wins.
5. After all of the above, do a real Urdu pass with a Nastaliq-friendly type designer or native Urdu reader to refine line breaks, punctuation, and any remaining "translated, not native" copy.
