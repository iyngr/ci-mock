# Talens Suite Landing (Internal)

Responsive single-page landing consolidating three internal talent intelligence capabilities:

| Product      | Purpose                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| Talens       | Faceless real-time interview with multi-agent orchestration and proctoring |
| Smart Mock   | Agentic scoring + hybrid question/practice generation                      |
| Smart Screen | Responsible AI resume intelligence & capability mapping                    |

## Features
- Google Store–inspired hero with three product panels
- Smooth scroll storytelling sections (single page, anchor-enabled)
- Framer Motion animations with prefers-reduced-motion fallbacks
- Accessibility: semantic headings, focus styles, contrast-aware palette
- Internal tone: informative, not marketing hype

## Dev
```bash
pnpm install
pnpm dev --filter talens-suite
```
Site runs on http://localhost:3010.

## Deploy (Azure Static Web Apps)
Provide build output from Next.js (`next build && next export` if static) or use SSR capability; configure `app_location` to `talens-suite`.

## Editing Copy
Update structured data in `src/app/page.tsx` products array and bullet lists.

Design inspired by Google Store layout for internal demonstration purposes only.
