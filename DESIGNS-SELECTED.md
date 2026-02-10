# Invert IDE — Selected Design Themes

> Two finalist themes selected for iteration. Both eliminate all `backdrop-filter`, `filter: blur()`, gradient backgrounds, and `transition: all` from the current design. Both preserve the established brand pillars.

---

## Brand Pillars (Preserved Across Both Themes)

| Pillar                          | Expression                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Code-as-UI motif**            | `//` comment prefixes on section headers, `const`/`import` decorations on form fields, syntax-highlighted code snippets in the dashboard |
| **Monospace-first interaction** | JetBrains Mono for buttons, inputs, labels, navigation — everything the user touches is rendered in a code font                          |
| **Accent left-border language** | 3px colored left-border on active items, code snippets, and card highlights — a consistent spatial anchor                                |
| **Unsaved pulse indicator**     | Small dot with a rhythmic pulse on modified scripts — functional UX that doubles as brand texture                                        |
| **Cursor blink**                | `step-end` blinking cursor in the dashboard header — a small, memorable detail                                                           |

---

## Theme A: Warm Carbon

### Description

A dark theme that deliberately breaks from the cold blue-grey convention. The surface palette is built on **warm charcoal** — dark browns, umber, and sepia-tinted blacks — evoking premium materials: anodized titanium, smoked oak, aged leather. Combined with a **warm gold accent** (`#d4a054`) and cream-tinted text (`#e8e0d4`), the entire interface has an organic warmth that feels handcrafted rather than generated.

The design language borrows from **high-end audio equipment** (tube amplifiers, analogue mixing consoles) and **architectural material palettes**. Surfaces are flat and matte, differentiated by warm-cool temperature shifts within the brown family. Borders are thin and warm. The overall mood says: _this tool was built with care, by someone who appreciates craft_.

### Brand Differentiators

- **What makes it special**: Warm-toned dark themes are genuinely rare. The overwhelming majority of dark UIs use cool greys, blue-greys, or neutral greys. A warm carbon palette immediately registers as different and intentional — it signals that someone made a deliberate aesthetic choice rather than defaulting to `#1e1e1e`.
- **What distinguishes the brand**: The combination of warm surfaces with the code-as-UI motif creates a unique tension — _warm materials housing cold logic_. It's the visual equivalent of a leather-bound technical manual. The `//` comment decorations and syntax highlighting feel especially striking against warm tones because they introduce the _only_ cool colors in the whole UI (blue syntax, teal types).
- **Design decisions for differentiation**: The gold accent replaces the current amber with a more muted, sophisticated variant. Where the current `#ffba00` is neon-bright, the proposed `#d4a054` is a burnished gold — less "warning light," more "brass hardware." This single temperature shift repositions the entire brand from "cyberpunk dashboard" to "premium developer tool."

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                                                  |
| ------------------------ | ----------- | ------------------------------------------------------ |
| `--base-black`           | `#12100e`   | App background — warm near-black (red-brown undertone) |
| `--base-surface-raised`  | `#1c1916`   | Sidebar, panels — warm dark brown                      |
| `--base-surface-overlay` | `#24201c`   | Elevated surfaces — lighter warm brown                 |
| `--base-border`          | `#332e28`   | Borders — warm medium-dark                             |
| `--base-border-subtle`   | `#2a2622`   | Subtle separators                                      |
| `--base-white`           | `#e8e0d4`   | Primary text — cream, warm white                       |
| `--base-grey`            | `#8a7e70`   | Secondary text — warm taupe                            |
| `--base-accent`          | `#d4a054`   | Burnished gold — primary actions                       |
| `--base-accent-muted`    | `#d4a05425` | Gold at 15% — selection, focus bg                      |
| `--base-primary`         | `#6b9edd`   | Soft steel blue — links, info                          |
| `--base-danger`          | `#c45353`   | Warm red — errors                                      |
| `--base-success`         | `#7ab06a`   | Sage green — success states                            |

#### Typography Colors

| Variant            | Color     | Notes                               |
| ------------------ | --------- | ----------------------------------- |
| Title              | `#e8e0d4` | Cream white — warm, easy on eyes    |
| Subtitle           | `#a89a8a` | Warm mid-tone                       |
| Body               | `#c4b8a8` | Warm light taupe                    |
| Caption / Label    | `#8a7e70` | Warm grey, uppercase monospace      |
| Input text         | `#e8e0d4` | Cream — matches title               |
| Placeholder        | `#5a5248` | Warm dark grey                      |
| `//` comment decor | `#8a7e70` | Warm taupe — blends with UI warmth  |
| Syntax keyword     | `#da9bf5` | Lavender — cool pop against warm bg |
| Syntax function    | `#e8d08a` | Warm yellow — harmonizes            |
| Syntax type        | `#6bc4b0` | Sage teal — cool accent             |

#### Surface & Container System

| Element                | Background                    | Border                               | Notes                              |
| ---------------------- | ----------------------------- | ------------------------------------ | ---------------------------------- |
| App root               | `#12100e`                     | —                                    | Warm void                          |
| Sidebar                | `#1c1916`                     | 1px right `#332e28`                  | Warm panel                         |
| Cards / Sections       | `#1c1916`                     | 1px `#332e28`, 4px radius            | Matte, flat                        |
| Inputs                 | `#18150f`                     | 1px `#332e28` → `#d4a05450` on focus | Gold focus border                  |
| Button (primary)       | `#d4a054` fg on `transparent` | 1px `#d4a054`                        | Outlined gold                      |
| Button (primary hover) | `#d4a05418` fill              | 1px `#d4a054`                        | Subtle gold wash                   |
| Active list item       | `#d4a05412`                   | 3px left `#d4a054`                   | Gold accent bar                    |
| Hover states           | `#ffffff08` overlay           | —                                    | Micro white overlay on interactive |

### Animations

| Element              | Animation                          | Details                                                       |
| -------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Page transitions     | Opacity                            | `transition: opacity 180ms ease`                              |
| Interactive elements | `background-color`, `border-color` | `transition: 150ms ease` — warm, unhurried                    |
| Button press         | `scale(0.98)`                      | 80ms — tactile micro-feedback                                 |
| Cursor blink         | Preserved                          | Uses gold instead of amber                                    |
| Unsaved indicator    | Opacity pulse                      | Gold dot, 2s cycle                                            |
| List reveal          | **Minimal**: single `opacity` fade | 200ms — no translateY/translateX, instant spatial positioning |

**Total `backdrop-filter` instances: 0. Total `box-shadow` instances: 0.**

**One exception**: The Monaco editor wrapper gets a single `box-shadow: inset 0 1px 0 #ffffff06` — a hairline top-edge highlight that mimics a beveled physical edge. This is the _only_ shadow in the entire theme, used as a warm material texture cue.

### Advantages & Disadvantages

| Advantages                                                                                 | Disadvantages                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Unique palette** — virtually no competitor uses warm-toned dark surfaces                 | Warm browns can feel "muddy" if contrast ratios aren't precisely managed                                                        |
| **Reduced eye strain** — warm tones are easier on eyes in dim environments than cool greys | Syntax highlighting colors need careful retuning to harmonize with warm backgrounds (current VS Code-inspired colors may clash) |
| **Premium "crafted" feel** — communicates intentionality and quality                       | Users accustomed to cool-toned editors (VS Code, JetBrains) may need adjustment time                                            |
| **Gold accent is sophisticated** — positions the brand above typical neon accents          | Gold-on-brown has lower contrast than gold-on-black — requires WCAG verification                                                |
| **Material metaphor** (leather, wood, brass) creates emotional resonance                   | The warm palette locks out cold-accent variants — less flexible for future theming                                              |
| **Flat rendering** — no GPU overhead from transparency or blur                             | —                                                                                                                               |
| **Ages gracefully** — earthy tones don't feel trend-dependent                              | —                                                                                                                               |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #12100e  Warm Black Root                                   │
│                                                             │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │                                                  │  │
│  │    │  // settings                                     │  │
│  │    │  #8a7e70  (warm taupe, monospace)                 │  │
│  │    │                                                  │  │
│  │ #1 │  ┌───────────────────────┐  ┌──────────────────┐ │  │
│  │ c  │  │  #1c1916             │  │  #1c1916         │ │  │
│  │ 1  │  │  Card: Theme         │  │  Card: Font Size │ │  │
│  │ 9  │  │                      │  │                  │ │  │
│  │ 1  │  │  ┌────────────────┐  │  │  ┌────────────┐  │ │  │
│  │ 6  │  │  │ Select ▾       │  │  │  │ 14         │  │ │  │
│  │    │  │  │ #18150f        │  │  │  │ #18150f    │  │ │  │
│  │    │  │  │ 1px #332e28    │  │  │  │ 1px warm   │  │ │  │
│  │    │  │  └────────────────┘  │  │  └────────────┘  │ │  │
│  │    │  └───────────────────────┘  └──────────────────┘ │  │
│  │    │                                                  │  │
│  │    │  Accent: #d4a054 burnished gold                  │  │
│  │    │  Text: #e8e0d4 cream                             │  │
│  │    │  Label: #8a7e70 warm taupe                       │  │
│  │    │                                                  │  │
│  └────┴──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme B: Obsidian Mono

### Description

An **ultra-dark, monochromatic theme** that takes minimalism to its logical extreme. The entire UI is built from a single hue: **pure neutral grey**, spanning from `#000000` to `#ffffff` with no colored tint whatsoever. The accent is **white** — or more precisely, a hierarchical system of white opacities. There is no blue, no amber, no teal. The _only_ color in the entire interface comes from syntax highlighting in the editor.

This creates a striking visual effect: the UI chrome is a perfectly silent, zero-distraction frame, and all chromatic energy is reserved for the code itself. When a user glances at the screen, their eye is pulled directly to the syntax-highlighted editor content because it's the only source of color.

The design borrows from **gallery exhibition design** — black walls with spotlit artwork — and **high-end camera interfaces** (Leica's minimal aesthetic, Hasselblad's control screens). Every element is pared to its absolute essence.

### Brand Differentiators

- **What makes it special**: A truly monochromatic developer tool UI does not exist. Every IDE, editor, and extension uses at least one accent color. Obsidian Mono dares to say: _the code is the color_. This is a radical position that is impossible to confuse with anything else on the market.
- **What distinguishes the brand**: The brand identity shifts from the accent color to the **structural language**: the code-as-UI decorations, the typographic hierarchy, the 3px left-border (now rendered in white at varying opacities), and the precise grid become the ENTIRE visual identity. When trademark color is removed, these structural decisions become unmistakably yours.
- **Design decisions for differentiation**: Use **opacity as the primary design variable** instead of hue. Every state change (hover, focus, active, disabled) is expressed through a shift in white/black opacity. This creates an extremely subtle, almost subliminal interaction language that rewards careful attention.

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                                                 |
| ------------------------ | ----------- | ----------------------------------------------------- |
| `--base-black`           | `#000000`   | True black — app background                           |
| `--base-surface-raised`  | `#0e0e0e`   | Sidebar, panels                                       |
| `--base-surface-overlay` | `#181818`   | Cards, headers                                        |
| `--base-border`          | `#262626`   | All borders                                           |
| `--base-border-focus`    | `#404040`   | Focused borders                                       |
| `--base-white`           | `#d0d0d0`   | Primary text — rolled-back white                      |
| `--base-grey`            | `#707070`   | Secondary text, labels                                |
| `--base-grey-dim`        | `#404040`   | Tertiary text, placeholder                            |
| `--base-accent`          | `#ffffff`   | White — the "accent"                                  |
| `--base-accent-muted`    | `#ffffff15` | White at 8% — selection, hover bg                     |
| `--base-accent-border`   | `#ffffff30` | White at 19% — focus borders                          |
| `--base-danger`          | `#ff4444`   | **Exception**: red is purely semantic, not decorative |
| `--base-success`         | `#44ff44`   | **Exception**: green for success only                 |
| `--base-warning`         | `#ffaa00`   | **Exception**: amber for warnings                     |

> Semantic status colors (danger, success, warning) are the only hue exceptions. They appear exclusively in validation messages and status indicators — never in chrome or navigation.

#### Typography Colors

| Variant            | Color / Opacity | Notes                              |
| ------------------ | --------------- | ---------------------------------- |
| Title              | `#d0d0d0`       | Brightest text level               |
| Subtitle           | `#909090`       | Mid-grey                           |
| Body               | `#a0a0a0`       | Comfortable reading grey           |
| Caption / Label    | `#707070`       | Dim — uppercase monospace          |
| Input text         | `#d0d0d0`       | Bright for input readability       |
| Placeholder        | `#383838`       | Nearly invisible — appears on type |
| `//` comment decor | `#505050`       | Subtle, structural                 |
| Active nav icon    | `#ffffff`       | Full white — the "accent"          |
| Inactive nav icon  | `#505050`       | Dim grey                           |

#### Surface & Container System

| Element            | Background                   | Border                               | Notes                                   |
| ------------------ | ---------------------------- | ------------------------------------ | --------------------------------------- |
| App root           | `#000000`                    | —                                    | Void                                    |
| Sidebar            | `#0e0e0e`                    | 1px right `#262626`                  | Near-invisible differentiation          |
| Cards              | `#0e0e0e`                    | 1px `#262626`                        | Barely raised                           |
| Inputs             | `#080808`                    | 1px `#262626` → `#ffffff30` on focus | White focus edge                        |
| Button (primary)   | `#ffffff` bg, `#000000` text | —                                    | Inverted — white button on black. Bold. |
| Button (secondary) | `transparent`                | 1px `#404040`                        | Grey outline                            |
| Active list item   | `#ffffff0a`                  | 3px left `#ffffff`                   | White bar — full brightness             |
| Selection          | `#ffffff10`                  | —                                    | Subtle white wash                       |
| Hover              | `#ffffff08`                  | —                                    | Micro white wash                        |

### Animations

| Element           | Animation                                     | Details                                                                                           |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| All interactions  | `opacity`, `background-color`, `border-color` | `transition: 100ms linear` — linear easing, not ease. **Sharp, mechanical.**                      |
| Focus             | `border-color`                                | 80ms — nearly instant                                                                             |
| Button press      | `opacity: 0.85`                               | 60ms — tighter than scale transform, less layout impact                                           |
| Cursor blink      | Preserved                                     | White cursor — `step-end`                                                                         |
| Unsaved indicator | White dot, **no pulse**                       | Static. The white dot against black is already maximally noticeable. Pulsing would be ornamental. |
| Page transitions  | **None**                                      | Instant — gallery walls don't move                                                                |

**Total keyframe animations: 1 (cursor blink). No transitions on non-interactive elements. Total property transitions: 3 max per element.**

### Advantages & Disadvantages

| Advantages                                                                                                 | Disadvantages                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Absolute performance** — the lightest possible CSS footprint. No non-trivial rendering operations.       | The monochrome palette is polarizing — some users will find it austere to the point of austerity                                                                |
| **Truly unique** — no other developer tool on the market is monochromatic. Zero competition in this space. | Status colors (red/green) can feel jarring when they appear in an otherwise colorless interface — needs careful contextual framing                              |
| **Code becomes the focus** — syntax highlighting is the only color, pulling the eye directly to the editor | Lower surface contrast between `#000000`, `#0e0e0e`, and `#181818` may be indistinguishable on some monitors (especially IPS panels with poor black uniformity) |
| **Impossible to "date"** — black and white is timeless                                                     | White primary buttons are bold but may cause momentary flash/glare in very dark environments                                                                    |
| **Consistent across monitors** — neutral greys don't color-shift under different gamma/color temperature   | The removal of a signature accent color (amber/gold) means the brand must rely entirely on structural/typographic identity                                      |
| **Full WCAG AA compliance** is trivial — only managing grey-on-black contrast ratios                       | Users cannot distinguish between types of interactive elements by color — must rely on shape, position, and labeling                                            |
| **Smallest CSS file** — fewer custom properties, no gradients, no opacity calculations                     | —                                                                                                                                                               |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #000000  True Black Void                                   │
│                                                             │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │                                                  │  │
│  │    │  // scripts                                      │  │
│  │ #0 │  #707070  (grey, monospace, uppercase)            │  │
│  │ e  │                                                  │  │
│  │ 0  │  ┌──────────┬───────────────────────────────────┐│  │
│  │ e  │  │  #0e0e0e │                                   ││  │
│  │ 0  │  │          │         #000000                   ││  │
│  │ e  │  │  Script  │      Monaco Editor                ││  │
│  │    │  │  List    │                                   ││  │
│  │ S  │  │          │  THE ONLY COLOR IN THE UI:        ││  │
│  │ I  │  │ ┌──────┐ │  ┌─────────────────────────┐     ││  │
│  │ D  │  │ │█ item│ │  │  const x = "hello"      │     ││  │
│  │ E  │  │ │white │ │  │  ^^^^^^ ^^^^   ^^^^^^^  │     ││  │
│  │ B  │  │ │bar   │ │  │  orchid  yel   green    │     ││  │
│  │ A  │  │ └──────┘ │  │  SYNTAX COLORS ARE      │     ││  │
│  │ R  │  │ ┌──────┐ │  │  THE HERO               │     ││  │
│  │    │  │ │ item │ │  └─────────────────────────┘     ││  │
│  │    │  │ └──────┘ │                                   ││  │
│  │    │  └──────────┴───────────────────────────────────┘│  │
│  └────┴──────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────┐                                       │
│  │  ██  Save  ██    │  ← White filled button on void       │
│  └──────────────────┘    The boldest element in the UI      │
└─────────────────────────────────────────────────────────────┘
```
