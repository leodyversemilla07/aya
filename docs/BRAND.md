# Aya brand guide

## Identity

**Aya** is an AI staff augmentation assistant for resource managers. The identity should feel calm,
precise, and human: a tool that reasons about people and projects without looking clinical.

The name is short and lowercase on purpose. It is easy to say, easy to type, and reads as approachable
rather than corporate.

## Logo type

Aya uses a **combination logo**: a letterform "A" monogram paired with a custom lowercase "aya"
wordmark.

- The **mark** carries the initial and works alone at small sizes: favicon, app icon, chat avatar.
- The **wordmark** keeps the name visible while the brand is still new.
- The two are locked together in the primary horizontal lockup with fixed relative proportions.

We deliberately avoided literal staffing imagery (people silhouettes, briefcases, network nodes) and
generic AI imagery (sparkles, gradients, glowing brains). The emerald dot above the mark is the one
owned accent.

## Assets

All brand files live in `apps/web/public/brand/`.

| File | Use |
|------|-----|
| `aya-logo.svg` | Primary horizontal lockup on light backgrounds |
| `aya-logo-dark.svg` | Primary horizontal lockup on dark backgrounds |
| `aya-wordmark.svg` | Wordmark only, light backgrounds |
| `aya-wordmark-dark.svg` | Wordmark only, dark backgrounds |
| `aya-logo-stacked.svg` | Stacked lockup, light backgrounds |
| `aya-logo-stacked-dark.svg` | Stacked lockup, dark backgrounds |
| `aya-logo-mono.svg` | One-color horizontal lockup (`currentColor`) |
| `aya-mark.svg` | Mark only, two-color |
| `aya-mark-mono.svg` | Mark only, one-color (`currentColor`) |
| `aya-app-icon.svg` | Rounded-square app icon |
| `apps/web/app/icon.svg` | Next.js app icon route |
| `apps/web/app/favicon.ico` | Raster favicon (16, 32, 48, 64) |

### When to use which

- **Horizontal lockup**: navigation, README hero, presentations, invoices, email signatures.
- **Stacked lockup**: square or narrow placements, social posts, event banners, merchandise.
- **Wordmark only**: tight horizontal spaces and partner lockups where the mark already appears.
- **Mark only**: favicons, app icons, chat avatars, collapsed sidebar, loading states.
- **Mono**: one-color printing, engraving, single-ink merch, or when color is unavailable.

## Color

| Token | Hex | Use |
|-------|-----|-----|
| Ink | `#0B0B0F` | Primary logo color on light backgrounds |
| Warm white | `#F5F5F4` | Logo color on dark backgrounds |
| Emerald | `#12B886` | Accent dot on light backgrounds |
| Emerald bright | `#34D399` | Accent dot on dark backgrounds |

The emerald accent is decorative. It is **not** safe for body text on white; use ink for text and
reserve emerald for the dot, focus states, and small highlights.

## Typography

- The wordmark is drawn as vector paths and does not depend on a font. Do not recreate it by typing
  "aya" in a system font.
- The product UI uses **Geist** for sans-serif and **Geist Mono** for code, loaded in
  `apps/web/app/layout.tsx`.

## Clear space

Keep free space around every lockup equal to at least **two emerald-dot diameters** on all sides.
One diameter is the absolute minimum for very tight layouts.

Do not place text, rules, or other logos inside that space.

## Minimum sizes

| Asset | Minimum width | Notes |
|-------|---------------|-------|
| Mark | 16 px | Favicon floor |
| Wordmark | 64 px | Below this, use the mark |
| Horizontal lockup | 96 px | Below this, use the mark |
| Stacked lockup | 72 px | Below this, use the mark |
| App icon | 16 px | 32 px recommended |

## Usage rules

**Do**

- Use SVG wherever possible; export PNG only when a platform requires it.
- Pick the light or dark variant based on the background.
- Keep the original proportions and spacing.
- Use the app icon for favicons, avatars, and social profiles.
- Use mono when color reproduction is limited.

**Don't**

- Recolor the logo outside the mono variants.
- Stretch, squash, rotate, or skew it.
- Add shadows, glows, gradients, outlines, or 3D effects.
- Rearrange the mark, dot, and wordmark.
- Place the logo on busy imagery without a solid container.
- Crop the mark or use only part of the wordmark.
- Use the emerald dot as a generic bullet or decoration.

## Application notes

- **Collapsed sidebar**: mark only, 24–32 px.
- **Expanded sidebar**: horizontal lockup, at least 96 px wide.
- **Chat assistant avatar**: mark on an ink rounded square, 32–40 px. This is the natural home for the
  emerald dot.
- **Dark mode**: use the dark lockup, or inline the mono SVG and set `color` to inherit the theme.
- **README and docs**: horizontal lockup on a light background.

### Exporting PNGs

From `apps/web/public/brand/`:

```bash
magick -background none aya-logo.svg -resize 1200x aya-logo.png
magick -background none aya-app-icon.svg -resize 512x512 aya-app-icon.png
```

Regenerate the favicon from the app icon:

```bash
magick aya-app-icon.png -define icon:auto-resize=64,48,32,16 apps/web/app/favicon.ico
```

## Governance

- The files in `apps/web/public/brand/` are the source of truth.
- Change all variants together so the geometry stays in sync.
- The mark has not been registered as a trademark. Run a trademark search in your relevant
  jurisdiction before a public launch.
