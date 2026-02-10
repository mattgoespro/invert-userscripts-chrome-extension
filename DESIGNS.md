# Invert IDE — Design Theme Concepts

> **Context**: The current UI uses a cyberpunk-esque dark theme with heavy glassmorphism, ambient glow orbs, `backdrop-filter: blur()` on ~6 surfaces, and continuous CSS animations. While the design token architecture is solid, the visual language has drifted toward generic "AI dark dashboard" territory — glass cards, blurred gradients, hover-lift effects — that is both performance-costly and aesthetically undifferentiated.
>
> **Goal**: Identify a flat, sleek, modern direction that prioritizes editor responsiveness, visual distinctiveness, and brand coherence. Each concept below preserves the established brand pillars: **code-as-UI decorations** (`//` comment prefixes, syntax-highlighted headings, cursor blink), **JetBrains Mono as the interactive font**, and the **3-tier token architecture**.

---

## Brand Pillars (Preserved Across All Themes)

These elements define Invert IDE's identity regardless of which theme direction is chosen:

| Pillar                          | Expression                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Code-as-UI motif**            | `//` comment prefixes on section headers, `const`/`import` decorations on form fields, syntax-highlighted code snippets in the dashboard |
| **Monospace-first interaction** | JetBrains Mono for buttons, inputs, labels, navigation — everything the user touches is rendered in a code font                          |
| **Accent left-border language** | 3px colored left-border on active items, code snippets, and card highlights — a consistent spatial anchor                                |
| **Unsaved pulse indicator**     | Small dot with a rhythmic pulse on modified scripts — functional UX that doubles as brand texture                                        |
| **Cursor blink**                | `step-end` blinking cursor in the dashboard header — a small, memorable detail                                                           |

---

## Theme 1: Matte Terminal

### Description

A theme rooted in the aesthetics of classic terminal emulators — VT100 phosphor screens, Bloomberg terminals, airport departure boards — but executed with modern precision and restraint. The defining characteristic is **total flatness**: zero transparency, zero blur, zero gradients, zero shadows. Surfaces are differentiated purely through 3–4 carefully tuned shades of near-black, separated by crisp 1px borders. Color is rationed like fuel — the amber accent appears only where it carries meaning (active states, unsaved indicators, primary actions), making every colored pixel significant.

The result feels like a precision instrument: dense, fast, unapologetic. It communicates that this is a _tool for professionals_, not a dashboard to admire.

### Brand Differentiators

- **What makes it special**: The radical absence of decoration IS the statement. In a landscape of glowing, blurred, gradient-washed developer tools, a completely flat matte surface with nothing but sharp borders and purposeful color is immediately recognizable. It looks like nothing else in the Chrome extension ecosystem.
- **What distinguishes the brand**: The code-as-UI decorations (`//` headers, syntax-colored labels) become the _only_ ornamentation in the entire interface, which amplifies their impact tenfold. When a `--syntax-keyword` colored orchid `const` keyword is the most colorful thing on screen, it becomes a genuine design focal point rather than one effect competing with many.
- **Design decisions for differentiation**: Commit to a strict "no cosmetic CSS" rule — every CSS property must serve either layout, readability, or interaction feedback. No decorative pseudo-elements, no filter effects, no box-shadows. This positions Invert IDE as the anti-Electron-bloat tool.

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                                                |
| ------------------------ | ----------- | ---------------------------------------------------- |
| `--base-black`           | `#0c0c0c`   | Application background — true near-black             |
| `--base-surface-raised`  | `#161616`   | Sidebar, panel backgrounds, card surfaces            |
| `--base-surface-overlay` | `#1e1e1e`   | Elevated containers, modal backgrounds               |
| `--base-border`          | `#2a2a2a`   | All borders — single, consistent 1px solid           |
| `--base-border-focus`    | `#3a3a3a`   | Focused/hovered border state                         |
| `--base-white`           | `#d4d4d4`   | Primary text — slightly muted white (not harsh)      |
| `--base-grey`            | `#6b6b6b`   | Secondary text, labels, placeholders                 |
| `--base-accent`          | `#e5a000`   | Amber — primary actions, active indicators, switches |
| `--base-accent-muted`    | `#e5a00040` | Amber at 25% — subtle selection highlight            |
| `--base-primary`         | `#3b82f6`   | Blue — links, informational states                   |
| `--base-danger`          | `#dc2626`   | Red — delete actions, error states                   |

#### Typography Colors

| Variant     | Color     | Token                                 |
| ----------- | --------- | ------------------------------------- |
| Title       | `#d4d4d4` | Full brightness white                 |
| Subtitle    | `#a0a0a0` | Mid-grey — clear hierarchy separation |
| Body        | `#b0b0b0` | Slightly brighter than subtitle       |
| Caption     | `#6b6b6b` | Muted grey                            |
| Form labels | `#6b6b6b` | Same as caption, uppercase monospace  |
| Input text  | `#d4d4d4` | Full brightness for readability       |
| Placeholder | `#4a4a4a` | Dim but visible                       |

#### Surface & Container System

| Element             | Background    | Border                             | Shadow |
| ------------------- | ------------- | ---------------------------------- | ------ |
| App root            | `#0c0c0c`     | —                                  | None   |
| Sidebar             | `#161616`     | 1px right `#2a2a2a`                | None   |
| Panel / Card        | `#161616`     | 1px `#2a2a2a`                      | None   |
| Input / Select      | `#1e1e1e`     | 1px `#2a2a2a` → `#3a3a3a` on focus | None   |
| Button (primary)    | `#e5a000`     | None                               | None   |
| Button (secondary)  | `transparent` | 1px `#2a2a2a`                      | None   |
| Active list item    | `#161616`     | 3px left `#e5a000`                 | None   |
| Selection highlight | `#e5a00015`   | —                                  | None   |

### Animations

| Element           | Animation          | Details                                                                                 |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Page transitions  | **None**           | Instant page swaps — speed is the priority                                              |
| Focus states      | `border-color`     | `transition: border-color 120ms ease` — fast, targeted                                  |
| Button hover      | `background-color` | `transition: background-color 100ms ease` — snappy                                      |
| Cursor blink      | `step-end` opacity | Preserved from current — brand element                                                  |
| Unsaved indicator | `opacity` pulse    | `animation: pulse 2s ease-in-out infinite` — no box-shadow, just opacity on a small dot |
| List items        | **None**           | Items appear instantly — no staggered reveals                                           |

**Total `backdrop-filter` instances: 0. Total `filter: blur()` instances: 0. Total `box-shadow` instances: 0.**

### Advantages & Disadvantages

| Advantages                                                                                   | Disadvantages                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Fastest rendering** — zero compositing layers from blur/shadow/transparency                | May feel too stark for users expecting a "designed" experience                                                                     |
| **Instantly differentiated** — nothing else in the Chrome extension space looks this austere | The boundary between "intentionally minimal" and "unfinished" requires perfect execution of spacing and typography                 |
| **Maximum code editor performance** — GPU is free to serve Monaco                            | Less room for visual celebration of user milestones (e.g. successful compilation)                                                  |
| **Timeless** — flat monochrome doesn't age like trends (glass, neumorphism)                  | Dark-on-dark surface differentiation requires careful calibration across different monitors/gamma settings                         |
| **Tiny CSS footprint** — fewer properties = faster style recalc                              | The amber accent carries heavy brand weight as the sole color — if overused it loses its punch, if underused the UI feels lifeless |
| **Accessibility** — high contrast ratios with no transparency interference                   | —                                                                                                                                  |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #0c0c0c  App Root                                          │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │  #161616  Panel Header          1px #2a2a2a      │  │
│  │    │  ┌──────────────────────────────────────────────┐│  │
│  │ S  │  │  // scripts                                  ││  │
│  │ I  │  │  #6b6b6b  monospace  uppercase                ││  │
│  │ D  │  └──────────────────────────────────────────────┘│  │
│  │ E  │                                                  │  │
│  │ B  │  ┌──────────┬───────────────────────────────────┐│  │
│  │ A  │  │ Script   │  #0c0c0c  Editor Background       ││  │
│  │ R  │  │ List     │                                    ││  │
│  │    │  │ #161616  │  ┌─────────────────────────────┐  ││  │
│  │ #1 │  │          │  │  Monaco Editor              │  ││  │
│  │ 6  │  │ ┌──────┐ │  │  (no decoration)            │  ││  │
│  │ 1  │  │ │▌item │ │  │                             │  ││  │
│  │ 6  │  │ │ active│ │  │                             │  ││  │
│  │ 1  │  │ └──────┘ │  │                             │  ││  │
│  │ 6  │  │ ┌──────┐ │  └─────────────────────────────┘  ││  │
│  │    │  │ │ item │ │                                    ││  │
│  │ 1  │  │ └──────┘ │        #e5a000 amber accent       ││  │
│  │ p  │  │          │        only on active left-border  ││  │
│  │ x  │  └──────────┴───────────────────────────────────┘│  │
│  │    │                                                  │  │
│  └────┴──────────────────────────────────────────────────┘  │
│         ▲ 1px #2a2a2a border on all panels                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme 2: Nordic Signal

### Description

Inspired by Scandinavian industrial design — Dieter Rams' "less but better" philosophy applied to a dark developer interface. The palette is cool-toned: deep slate blues and blue-greys as surfaces, with a single **teal/cyan accent** (`#22d3ee`) that cuts through the muted backdrop like a signal light on a Nordic fjord. Where Matte Terminal is warm and austere, Nordic Signal is cool and precise.

The design vocabulary is borrowed from signal processing and data visualization: thin horizontal rules, left-aligned data columns, monospaced numerics, subtle dotted separators. Every element is placed on a strict 8px grid. Whitespace is treated as a structural material, not empty space — generous padding communicates confidence and calm.

### Brand Differentiators

- **What makes it special**: The teal accent is rare in code editor UIs (which overwhelmingly default to blue, purple, or orange). Combined with slate surfaces and generous whitespace, the look evokes **precision scientific equipment** — oscilloscopes, spectrum analyzers, sonar displays. It feels like a tool that _measures and transforms_ code rather than just editing it.
- **What distinguishes the brand**: The combination of strict grid discipline, a single-accent-color rule, and code-as-UI decorations creates a "calm control room" atmosphere. While other IDEs feel busy and packed, Nordic Signal feels like there's space to breathe and think.
- **Design decisions for differentiation**: Enforce a single accent color throughout — no secondary orange, no purple. Teal is the _only_ non-grey color (aside from syntax highlighting and semantic states like error red). This constraints breeds distinctive consistency.

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                                       |
| ------------------------ | ----------- | ------------------------------------------- |
| `--base-black`           | `#0f1219`   | App background — very dark desaturated navy |
| `--base-surface-raised`  | `#181d27`   | Sidebar, card backgrounds                   |
| `--base-surface-overlay` | `#1f2535`   | Elevated panels, editor chrome              |
| `--base-border`          | `#2a3244`   | Primary border — slate blue                 |
| `--base-border-subtle`   | `#222a3a`   | Lighter separator lines                     |
| `--base-white`           | `#c8cdd6`   | Primary text — cool-toned soft white        |
| `--base-grey`            | `#5e6a80`   | Secondary text, labels                      |
| `--base-accent`          | `#22d3ee`   | Teal/cyan — sole accent for all actions     |
| `--base-accent-muted`    | `#22d3ee25` | Teal at 15% — selection fill, focus bg      |
| `--base-accent-border`   | `#22d3ee50` | Teal at 30% — focus borders                 |
| `--base-danger`          | `#ef4444`   | Red — errors, destructive actions           |
| `--base-warning`         | `#f59e0b`   | Amber — warnings only                       |

#### Typography Colors

| Variant            | Color     | Notes                               |
| ------------------ | --------- | ----------------------------------- |
| Title              | `#c8cdd6` | Cool white — calm authority         |
| Subtitle           | `#8892a4` | Blue-grey mid-tone                  |
| Body               | `#a0a8b8` | Slightly brighter body              |
| Caption / Label    | `#5e6a80` | Muted slate — uppercase monospace   |
| Input text         | `#c8cdd6` | Matches title for input readability |
| Placeholder        | `#3d4860` | Dark but discernible                |
| Code comment decor | `#5e6a80` | `// ` prefixes in muted slate       |

#### Surface & Container System

| Element                | Background                    | Border                               | Notes                                            |
| ---------------------- | ----------------------------- | ------------------------------------ | ------------------------------------------------ |
| App root               | `#0f1219`                     | —                                    | Cold, deep space                                 |
| Sidebar                | `#0f1219`                     | 1px right `#2a3244`                  | Same as root — distinguished by border only      |
| Cards / Sections       | `#181d27`                     | 1px `#2a3244`                        | Raised by one step                               |
| Inputs                 | `#141a24`                     | 1px `#2a3244` → `#22d3ee50` on focus | Focus: teal border + `#22d3ee12` background tint |
| Button (primary)       | `#22d3ee` text on transparent | 1px `#22d3ee`                        | Outlined teal — not filled. Clean and light.     |
| Button (primary hover) | `#22d3ee15` fill              | 1px `#22d3ee`                        | Subtle teal wash on hover                        |
| Active list item       | `#22d3ee10` bg                | 3px left `#22d3ee`                   | Teal accent bar                                  |
| Focused element        | —                             | `box-shadow: 0 0 0 1px #22d3ee50`    | Tight 1px ring, no spread                        |

### Animations

| Element             | Animation                          | Details                                                                  |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Page transitions    | Opacity crossfade                  | `transition: opacity 200ms ease` — subtle, no spatial movement           |
| Focus states        | `border-color`, `background-color` | `transition: border-color 120ms, background-color 120ms`                 |
| Button interactions | `background-color`                 | 100ms — instant-feeling                                                  |
| Cursor blink        | Preserved                          | Brand element — unchanged                                                |
| Unsaved indicator   | Teal dot pulse                     | `opacity` pulse, 2.5s, ease-in-out                                       |
| Sidebar nav icons   | `color` transition                 | 150ms — icon tints to teal on active                                     |
| Accordion/collapse  | `max-height` + `opacity`           | Settings sections: 200ms ease-out. Only animation with spatial movement. |

**Total `backdrop-filter` instances: 0. Total `filter: blur()` instances: 0.**

### Advantages & Disadvantages

| Advantages                                                                                                         | Disadvantages                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Cool-toned palette reduces eye strain** in long coding sessions (blue light is lower-energy on dark backgrounds) | Teal accent may feel clinical/sterile to some users who prefer warmer palettes                                   |
| **Single accent color** creates effortless consistency — impossible to clash                                       | The cool-neutral palette requires very precise contrast calibration; slight miscalibration reads as "washed out" |
| **Generous whitespace** gives the UI a calm, premium feel                                                          | More whitespace means less information density — scripts list shows fewer items per viewport                     |
| **Slate surfaces** are easier to differentiate on varied monitors than pure-grey themes                            | Blue-tinted greys can shift unpleasantly under certain f.lux/Night Light color temperature settings              |
| **Outlined primary buttons** feel lighter and more modern than filled buttons                                      | Outlined buttons have lower visual prominence — may need larger click targets to compensate                      |
| **Zero blur/transparency** — near-zero GPU overhead                                                                | —                                                                                                                |
| **"Scientific tool" identity** is uncommon and memorable in the extension space                                    | —                                                                                                                |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #0f1219  App Background (deep navy-black)                  │
│                                                             │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │                                                  │  │
│  │    │    // scripts                                    │  │
│  │    │    #5e6a80  (muted slate, uppercase)              │  │
│  │ S  │    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  #222a3a       │  │
│  │ I  │                                                  │  │
│  │ D  │  ┌───────────┬──────────────────────────────────┐│  │
│  │ E  │  │           │                                  ││  │
│  │ B  │  │  #181d27  │    #0f1219  Editor               ││  │
│  │ A  │  │           │                                  ││  │
│  │ R  │  │ ┌───────┐ │    ┌────────────────────────┐    ││  │
│  │    │  │ │ ▍item │ │    │                        │    ││  │
│  │ #0 │  │ │ #22d3 │ │    │   Monaco Editor        │    ││  │
│  │ f  │  │ │  ee   │ │    │                        │    ││  │
│  │ 1  │  │ │ teal  │ │    │                        │    ││  │
│  │ 2  │  │ │ bar   │ │    └────────────────────────┘    ││  │
│  │ 1  │  │ └───────┘ │                                  ││  │
│  │ 9  │  │ ┌───────┐ │    ┌────────────────────────┐    ││  │
│  │    │  │ │  item │ │    │ [ outlined teal btn  ] │    ││  │
│  │    │  │ └───────┘ │    └────────────────────────┘    ││  │
│  │    │  └───────────┴──────────────────────────────────┘│  │
│  └────┴──────────────────────────────────────────────────┘  │
│                                                             │
│    Teal (#22d3ee) is the ONLY non-grey color in the UI      │
│    (aside from syntax highlighting tokens)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme 3: Warm Carbon

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

## Theme 4: Graphite Studio

### Description

A **mid-tone neutral theme** inspired by professional creative software — Figma's design, Blender's 3D viewport, DaVinci Resolve's color page, Ableton's arrangement view. The defining move: surfaces are **medium grey** (`#303030`–`#3c3c3c`), not dark and not light. This puts the interface in a "middle ground" that eliminates the harshness of both extremes. The editor content area remains dark (as Monaco expects), creating a natural visual hierarchy where the chrome recedes and the code commands attention.

Borders are subtle (1px, close-value greys), shadows are absent, and the accent is a **vivid blue-violet** (`#7c6aef`) — a hue that reads as creative and technical simultaneously. The mid-tone palette means syntax highlighting has _maximum relative contrast_ in the dark editor well — colors pop against the dark editor while the surrounding chrome stays neutral.

### Brand Differentiators

- **What makes it special**: Mid-tone grey interfaces are extraordinarily rare in browser-based tools since the web defaults to either white or very dark backgrounds. This immediately signals "desktop-class creative tool" rather than "web app." Users who spend time in Figma, Blender, or DAWs will feel an instant familiarity and trust.
- **What distinguishes the brand**: The code-as-UI motif gains a new dimension on mid-grey — the `//` comment decorations can be rendered in a slightly lighter grey that almost disappears, making them feel like watermarks etched into the surface rather than painted-on labels. The IDE becomes the canvas, and the code is the art on it.
- **Design decisions for differentiation**: The editor area (Monaco) is darkened to `#1a1a1a` while the chrome is `#303030`+, creating a "well" effect — the code literally sits in a darker depression, like a viewport cut into the interface. This functional depth is achieved through flat color alone, not shadows or blur.

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                               |
| ------------------------ | ----------- | ----------------------------------- |
| `--base-black`           | `#1a1a1a`   | Editor background only — the "well" |
| `--base-surface-base`    | `#282828`   | App base — below panels             |
| `--base-surface-raised`  | `#303030`   | Sidebar, primary panels             |
| `--base-surface-overlay` | `#3a3a3a`   | Cards, elevated containers, headers |
| `--base-surface-input`   | `#252525`   | Input fields — darker than chrome   |
| `--base-border`          | `#444444`   | Primary borders                     |
| `--base-border-subtle`   | `#383838`   | Light separators                    |
| `--base-white`           | `#e0e0e0`   | Primary text                        |
| `--base-grey`            | `#888888`   | Secondary text                      |
| `--base-grey-dim`        | `#666666`   | Tertiary text, labels               |
| `--base-accent`          | `#7c6aef`   | Blue-violet — primary actions       |
| `--base-accent-hover`    | `#8f80f2`   | Lighter violet on hover             |
| `--base-accent-muted`    | `#7c6aef20` | Violet at 12% — selection bg        |
| `--base-danger`          | `#e5534b`   | Warm red                            |
| `--base-success`         | `#57ab5a`   | Green                               |
| `--base-warning`         | `#c69026`   | Amber                               |

#### Typography Colors

| Variant            | Color     | Notes                                       |
| ------------------ | --------- | ------------------------------------------- |
| Title              | `#e0e0e0` | Clear white                                 |
| Subtitle           | `#aaaaaa` | Medium grey                                 |
| Body               | `#bbbbbb` | Light grey                                  |
| Caption / Label    | `#888888` | Mid-grey, uppercase monospace               |
| Input text         | `#e0e0e0` | Bright for readability in dark wells        |
| Placeholder        | `#555555` | Subdued                                     |
| `//` comment decor | `#666666` | Subtle — nearly invisible, like a watermark |

#### Surface & Container System

| Element            | Background     | Border                               | Notes                                       |
| ------------------ | -------------- | ------------------------------------ | ------------------------------------------- |
| App root           | `#282828`      | —                                    | Mid-dark neutral                            |
| Sidebar            | `#303030`      | 1px right `#444444`                  | Raised panel                                |
| Section header     | `#3a3a3a`      | 1px bottom `#444444`                 | Elevated chrome                             |
| Cards              | `#3a3a3a`      | 1px `#444444`, 4px radius            | Flat, mid-grey                              |
| Editor "well"      | `#1a1a1a`      | 1px `#383838`                        | Darkened code area                          |
| Inputs             | `#252525`      | 1px `#383838` → `#7c6aef60` on focus | Darker than surrounding chrome = inset feel |
| Button (primary)   | `#7c6aef` fill | —                                    | Solid fill — stands out against grey chrome |
| Button (secondary) | `transparent`  | 1px `#444444`                        | Grey outline                                |
| Active list item   | `#7c6aef15`    | 3px left `#7c6aef`                   | Violet bar                                  |

### Animations

| Element              | Animation                    | Details                                                                |
| -------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Page transitions     | Opacity + translateY         | `transition: opacity 200ms, transform 200ms ease-out` — 4px Y movement |
| Focus                | `border-color`, `box-shadow` | 120ms — tight focus ring `0 0 0 1px #7c6aef40`                         |
| Button hover         | `background-color`           | 120ms                                                                  |
| Active tab indicator | `width` slide                | 200ms ease — an underline slides to active tab position                |
| Cursor blink         | Preserved                    | Uses violet glow instead of amber                                      |
| Unsaved indicator    | Violet dot pulse             | Opacity, 2s                                                            |
| Panel resize         | Live                         | No transition — instant resize for performance                         |

### Advantages & Disadvantages

| Advantages                                                                                                             | Disadvantages                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **"Desktop app" gravitas** — mid-tone grey immediately evokes professional creative software (Figma, Blender, Resolve) | Mid-grey chrome may feel unfamiliar to users expecting a dark or light theme                                                    |
| **Natural visual hierarchy** — dark editor "well" draws the eye to code without any decoration                         | Two distinct surface zones (mid-grey chrome + dark editor) require careful border management at the transition                  |
| **Syntax colors pop maximally** — dark editor background gives code maximum contrast while chrome stays neutral        | The blue-violet accent, while distinctive, is close to the purple range that some colorblind users struggle with (deuteranopia) |
| **Reduced eye adaptation** — less extreme light-to-dark ratio compared to near-black themes                            | Mid-grey surfaces show fingerprints/smudges more noticeably if the concept extends to mobile/touch                              |
| **Flexible** — mid-tone grey is the most versatile base for both warm and cool accent variations                       | May need a light-mode variant for users who switch between theme types                                                          |
| **Zero blur/shadow overhead** — flat surfaces throughout                                                               | —                                                                                                                               |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #282828  App Root (mid-dark grey)                          │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  #3a3a3a  Header Bar                    1px #444444    │ │
│  │  // invert.ide          [icon] [icon] [icon]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────┬─────────────────────────────────────────────────┐  │
│  │    │  ┌──────────┬──────────────────────────────────┐│  │
│  │ #3 │  │  #303030 │                                  ││  │
│  │ 0  │  │  Script  │            #1a1a1a               ││  │
│  │ 3  │  │  List    │         Editor "Well"            ││  │
│  │ 0  │  │          │                                  ││  │
│  │ 3  │  │ ┌──────┐ │     Dark area makes syntax       ││  │
│  │ 0  │  │ │▍item │ │     colors POP against the       ││  │
│  │    │  │ │violet│ │     neutral mid-grey chrome       ││  │
│  │ S  │  │ │accent│ │                                  ││  │
│  │ I  │  │ └──────┘ │     ┌──────────────────────┐     ││  │
│  │ D  │  │ ┌──────┐ │     │  const ▍              │     ││  │
│  │ E  │  │ │ item │ │     │  #da70d6  #dcdcaa     │     ││  │
│  │ B  │  │ └──────┘ │     │  syntax pops on dark  │     ││  │
│  │ A  │  │          │     └──────────────────────┘     ││  │
│  │ R  │  └──────────┴──────────────────────────────────┘│  │
│  └────┴─────────────────────────────────────────────────┘  │
│                                                             │
│  Chrome: #303030 / #3a3a3a    Editor Well: #1a1a1a         │
│  Accent: #7c6aef (blue-violet)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme 5: Ink & Paper

### Description

A **light theme** that rejects the standard "white background with grey borders" formula. Instead, it takes cues from **high-end editorial design** — Japanese stationery, architectural blueprints, letterpress printing, technical manuals. The primary surface is a warm off-white (`#f5f2ed`) with the slightest ivory/cream warmth — like thick cotton paper. Text is set in rich near-black (`#1a1816`) with generous tracking and careful typographic hierarchy.

The editor area inverts to a dark background (because code is meant to be read on dark surfaces), creating a dramatic **light-frame / dark-content** composition that looks like a code listing printed in a beautifully typeset book. The accent is **deep ink blue** (`#2955a0`) — the blue of a fine fountain pen — used with restraint for interactive elements and highlights.

### Brand Differentiators

- **What makes it special**: Light themes for code editors are common; light themes that look _beautiful_ are almost nonexistent. Most light IDE themes are utilitarian white with colored syntax. Ink & Paper elevates the concept by treating the chrome as a luxury editorial surface — warm paper tones, considered typography, and a dark editor "viewport" that makes the code feel like it's being _presented_, not just displayed.
- **What distinguishes the brand**: The `//` comment decorations, rendered in a muted warm grey on cream paper, evoke margin annotations in a technical manuscript. The monospace font reads as "typewriter on fine paper" rather than "terminal output." This completely reframes the code-as-UI motif from "hacker aesthetic" to "craftsman aesthetic."
- **Design decisions for differentiation**: Use a single border weight (1px) in a warm grey (`#d8d2c8`) everywhere. No border-radius on cards — sharp corners reference printed matter. The editor area gets a subtle 1px inset border that looks like a viewport cut into paper. No rounded-pill buttons — all rectangular with sharp edges.

### Color Palette

#### Core Palette

| Token                  | Hex         | Usage                               |
| ---------------------- | ----------- | ----------------------------------- |
| `--base-paper`         | `#f5f2ed`   | Primary surface — warm off-white    |
| `--base-paper-raised`  | `#edeae4`   | Cards, elevated panels              |
| `--base-paper-overlay` | `#e4e0d8`   | Header, footer, chrome              |
| `--base-editor`        | `#1a1816`   | Editor background — warm near-black |
| `--base-border`        | `#d8d2c8`   | Warm grey borders                   |
| `--base-border-strong` | `#c0b8ac`   | Emphasized borders                  |
| `--base-ink`           | `#1a1816`   | Primary text — warm near-black      |
| `--base-ink-light`     | `#5c564e`   | Secondary text                      |
| `--base-ink-faint`     | `#8a847a`   | Labels, captions                    |
| `--base-accent`        | `#2955a0`   | Deep ink blue — primary action      |
| `--base-accent-hover`  | `#1e4080`   | Darker blue on hover                |
| `--base-accent-muted`  | `#2955a018` | Blue at 10% — selection bg on paper |
| `--base-danger`        | `#b8352a`   | Warm red — ink red                  |
| `--base-success`       | `#2a7a3a`   | Forest green                        |

#### Typography Colors

| Variant            | Color     | Notes                                      |
| ------------------ | --------- | ------------------------------------------ |
| Title              | `#1a1816` | Rich ink black                             |
| Subtitle           | `#3a3630` | Dark brown-grey                            |
| Body               | `#2a2622` | Near-black — high contrast on paper        |
| Caption / Label    | `#8a847a` | Warm faint — like pencil marks on paper    |
| Input text         | `#1a1816` | Ink black                                  |
| Placeholder        | `#b8b2a8` | Light warm grey — like embossed guide text |
| `//` comment decor | `#b0a898` | Subtle — margin annotation feel            |
| Editor text        | `#d4d0c8` | Warm white — readable on dark editor       |

#### Surface & Container System

| Element            | Background     | Border                             | Notes                             |
| ------------------ | -------------- | ---------------------------------- | --------------------------------- |
| App root           | `#f5f2ed`      | —                                  | Warm paper                        |
| Sidebar            | `#edeae4`      | 1px right `#d8d2c8`                | Slightly tinted sidebar           |
| Cards / Sections   | `#edeae4`      | 1px `#d8d2c8`, **0px radius**      | Sharp corners — printed matter    |
| Editor viewport    | `#1a1816`      | 1px inset `#d8d2c8`                | Dark code area in light frame     |
| Inputs             | `#ffffff`      | 1px `#d8d2c8` → `#2955a0` on focus | Pure white field on cream         |
| Button (primary)   | `#2955a0` fill | —                                  | Solid ink blue, white text        |
| Button (secondary) | `transparent`  | 1px `#c0b8ac`                      | Warm grey outline                 |
| Active list item   | `#2955a01a`    | 3px left `#2955a0`                 | Blue bar on warm bg               |
| Focus ring         | —              | `box-shadow: 0 0 0 2px #2955a030`  | Blue focus glow — subtle on paper |

### Animations

| Element           | Animation              | Details                                                                          |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------- |
| Page transitions  | **None**               | Printed pages don't animate — instant swap, respecting the editorial metaphor    |
| Focus states      | `border-color`         | 100ms ease                                                                       |
| Button hover      | `background-color`     | 120ms                                                                            |
| Cursor blink      | Preserved              | Uses ink blue instead of amber                                                   |
| Unsaved indicator | Blue dot, no animation | Static visibility — editorial restraint. The dot is present or absent, no pulse. |
| Scroll            | Smooth native          | `scroll-behavior: smooth` on list containers                                     |

**Total animations: 2 (cursor blink, scroll). No keyframe animations. No transitions on non-interactive elements.**

### Advantages & Disadvantages

| Advantages                                                                                                         | Disadvantages                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Light themes are proven for daytime productivity** — reduces eye strain in well-lit environments                 | Users who work at night or in dark rooms will need a dark companion theme (this is a light-only concept)    |
| **Unique among code IDEs** — the editorial paper+ink aesthetic is completely uncharted territory                   | Sharp corners (0px radius) may feel harsh; needs to be balanced with generous spacing                       |
| **Maximum readability** — dark text on light paper is the highest-contrast combination for body text               | Dark editor inside light chrome creates a high-contrast edge that may feel jarring initially                |
| **Lightest rendering cost** — no blur, no shadows, no gradients, no transparency, no rounded corners to anti-alias | Limited visual affordance for depth — flat surfaces all at similar brightness need strong border discipline |
| **Print-ready** — screenshots and documentation captures look clean and professional                               | The warm cream tint (`#f5f2ed`) may shift toward yellow on some uncalibrated displays                       |
| **Distinctive brand positioning** — "the developer tool that looks like a beautiful book"                          | Not suitable as the sole theme — needs a dark counterpart for user preference                               |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #f5f2ed  Warm Paper Root                                   │
│                                                             │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │                                                  │  │
│  │    │  // scripts                                      │  │
│  │    │  #8a847a  pencil-grey, uppercase                  │  │
│  │ #e │  ──────────────────────────── #d8d2c8            │  │
│  │ d  │                                                  │  │
│  │ e  │  ┌──────────┬───────────────────────────────────┐│  │
│  │ a  │  │  #edeae4 │                                   ││  │
│  │ e  │  │  Script  │         #1a1816                   ││  │
│  │ 4  │  │  List    │      Dark Editor Viewport         ││  │
│  │    │  │          │                                   ││  │
│  │    │  │ ┌──────┐ │   ┌─────────────────────────┐     ││  │
│  │ S  │  │ │▍item │ │   │  const greet = () => {  │     ││  │
│  │ I  │  │ │ Blue │ │   │    // warm white text   │     ││  │
│  │ D  │  │ │ bar  │ │   │    // on ink-black bg   │     ││  │
│  │ E  │  │ └──────┘ │   └─────────────────────────┘     ││  │
│  │ B  │  │ ┌──────┐ │                                   ││  │
│  │ A  │  │ │ item │ │   Light frame + dark viewport     ││  │
│  │ R  │  │ └──────┘ │   = "code presented in a book"    ││  │
│  │    │  └──────────┴───────────────────────────────────┘│  │
│  └────┴──────────────────────────────────────────────────┘  │
│                                                             │
│  Paper: #f5f2ed     Ink: #1a1816     Accent: #2955a0       │
│  ALL corners: 0px radius (sharp — editorial precision)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme 6: Obsidian Mono

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

---

## Theme 7: Duotone Forge

### Description

A **high-contrast two-color system** that splits the interface into exactly two chromatic zones: a **deep indigo-black** base and a single **warm signal orange** (`#ff6b2b`). Every element in the UI is either dark (indigo-black at varying brightnesses), orange (at varying opacities), or the intersection of both. No grey — warmth comes from the orange wash, coolness from the indigo. No third color.

The concept is borrowed from **duotone printing** — a technique where a photograph is reproduced using only two ink colors, creating a bold, graphic image with surprising tonal range. Applied to UI, this creates a look that is simultaneously restrained and bold — the limited palette forces creative solutions for hierarchy and state, while the orange-on-dark combination is viscerally energetic.

This is the most _opinionated_ theme — it demands attention and positions Invert IDE as a tool with a strong point of view. The "forge" metaphor connects to the product's purpose: forging userscripts from raw TypeScript and SCSS.

### Brand Differentiators

- **What makes it special**: Two-color UI systems are seen in gaming (original Game Boy, Virtual Boy) and print design but almost never in developer tools. The duotone constraint is immediately recognizable and photographically compelling — every screenshot is a branded asset. The look is bold enough to be an identity system on its own.
- **What distinguishes the brand**: The word "forge" becomes literal in the visual — orange reads as heat, fire, molten metal. The `//` comment decorations, rendered in a dim orange wash, look like embers cooling in dark metal. The accent left-border is a bright orange slash — a cut of light in darkness. The unsaved pulse indicator pulses orange like a heartbeat. Every brand element is _amplified_ by the two-color constraint.
- **Design decisions for differentiation**: Enforce the duotone rule strictly: if it's not indigo-black and it's not orange, it doesn't exist in the chrome. Syntax highlighting in the editor is the only rule-breaker (it retains standard token colors for usability), which makes the editor feel like a portal to a multicolor world inside a monochrome frame.

### Color Palette

#### Core Palette

| Token                    | Hex         | Usage                                                         |
| ------------------------ | ----------- | ------------------------------------------------------------- |
| `--base-black`           | `#0a0a12`   | Indigo-black — app background                                 |
| `--base-surface-raised`  | `#12121c`   | Sidebar, panel bg                                             |
| `--base-surface-overlay` | `#1a1a28`   | Cards, elevated surfaces                                      |
| `--base-border`          | `#2a2a3c`   | Indigo-tinted borders                                         |
| `--base-white`           | `#c8c4d4`   | Primary text — cool lavender-white (from indigo family)       |
| `--base-grey`            | `#5e5a70`   | Secondary text — indigo-grey                                  |
| `--base-accent`          | `#ff6b2b`   | Signal orange — the ONLY warm color                           |
| `--base-accent-bright`   | `#ff8a55`   | Lighter orange for hover states                               |
| `--base-accent-muted`    | `#ff6b2b25` | Orange 15% — selection, focus bg                              |
| `--base-accent-dim`      | `#ff6b2b12` | Orange 7% — subtle hover wash                                 |
| `--base-danger`          | `#ff6b2b`   | **Same as accent** — in duotone, danger = more intense orange |
| `--base-danger-bg`       | `#ff6b2b15` | Orange wash for error backgrounds                             |

> **Note**: There is no separate danger color. Danger states use intensified orange (full opacity + background wash) with explicit "delete" / "error" labeling. This works because orange already carries urgency.

#### Typography Colors

| Variant             | Color       | Notes                                         |
| ------------------- | ----------- | --------------------------------------------- |
| Title               | `#c8c4d4`   | Cool lavender-white                           |
| Subtitle            | `#8a86a0`   | Indigo mid-tone                               |
| Body                | `#a8a4b8`   | Soft lavender-grey                            |
| Caption / Label     | `#5e5a70`   | Indigo-grey, uppercase monospace              |
| Input text          | `#c8c4d4`   | same as title                                 |
| Placeholder         | `#3a3850`   | Dark indigo                                   |
| `//` comment decor  | `#ff6b2b40` | Semi-transparent orange — like cooling embers |
| Active element text | `#ff6b2b`   | Full orange for active labels                 |

#### Surface & Container System

| Element            | Background          | Border                                     | Notes                                 |
| ------------------ | ------------------- | ------------------------------------------ | ------------------------------------- |
| App root           | `#0a0a12`           | —                                          | Deep indigo void                      |
| Sidebar            | `#12121c`           | 1px right `#2a2a3c`                        | Raised indigo                         |
| Cards              | `#12121c`           | 1px `#2a2a3c`, top-border: 2px `#ff6b2b20` | Orange top-edge wash for card headers |
| Inputs             | `#0e0e18`           | 1px `#2a2a3c` → `#ff6b2b60` on focus       | Orange focus                          |
| Button (primary)   | `#ff6b2b` fill      | —                                          | Solid orange, dark text               |
| Button (secondary) | `transparent`       | 1px `#ff6b2b50`                            | Semi-orange outline                   |
| Active list item   | `#ff6b2b12`         | 3px left `#ff6b2b`                         | Orange bar                            |
| Hover              | `#ff6b2b08` overlay | —                                          | Micro orange wash                     |

### Animations

| Element               | Animation                                   | Details                                                        |
| --------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Interactive elements  | `background-color`, `border-color`, `color` | `transition: 150ms ease`                                       |
| Focus states          | `border-color`, `box-shadow`                | 100ms — orange focus ring `0 0 0 1px #ff6b2b30`                |
| Button press          | `scale(0.97)`                               | 80ms — tactile                                                 |
| Cursor blink          | Orange cursor blink                         | `step-end`, brand element                                      |
| Unsaved indicator     | Orange dot pulse                            | `opacity` 2s ease-in-out — the "heartbeat"                     |
| List item reveal      | `opacity` only                              | 150ms stagger, no translation — items appear, they don't slide |
| Active nav transition | `color`                                     | 200ms — icon shifts from indigo-grey to orange                 |

**One permitted decorative element**: The dashboard header can have a single subtle `box-shadow: 0 0 40px 0 #ff6b2b08` on the page title — a barely-visible orange aura that suggests warmth without incurring heavy rendering. This is the only non-flat effect in the theme.

### Advantages & Disadvantages

| Advantages                                                                                      | Disadvantages                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Maximum brand recognition** — any screenshot is instantly identifiable as Invert IDE          | The two-color constraint limits semantic variety — harder to distinguish info vs. warning vs. active at a glance    |
| **Viscerally energetic** — orange-on-dark is attention-grabbing and exciting                    | Orange can cause visual fatigue if overused — requires careful rationing                                            |
| **"Forge" metaphor is tangible** — heat/fire/metal narrative strengthens product identity       | No separate danger color means destructive actions need extra UX safeguards (confirmation dialogs, explicit labels) |
| **Print/marketing ready** — duotone is inherently graphic and poster-worthy                     | The indigo-tinted surfaces are unusual; users expecting neutral grey may find the purple tint distracting           |
| **Small palette = fast design decisions** — every element resolves to one of two colors         | May feel restrictive for future features (e.g., distinguishing TS vs SCSS tabs would need shape/icon, not color)    |
| **Low rendering cost** — flat, minimal transitions, one subtle glow                             | The bold aesthetic may feel like "too much personality" for some professional users                                 |
| **Strong emotional response** — users either love it or it's not for them, but they remember it | —                                                                                                                   |

### Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  #0a0a12  Deep Indigo Void                                  │
│                                                             │
│  ┌────┬──────────────────────────────────────────────────┐  │
│  │    │  ┌──────────────────────────────────────────────┐│  │
│  │    │  │  2px top #ff6b2b20  (orange wash)            ││  │
│  │ #1 │  │  // scripts                                  ││  │
│  │ 2  │  │  #ff6b2b40  (orange ember text)              ││  │
│  │ 1  │  └──────────────────────────────────────────────┘│  │
│  │ 2  │                                                  │  │
│  │ 1  │  ┌──────────┬───────────────────────────────────┐│  │
│  │ c  │  │  #12121c │                                   ││  │
│  │    │  │          │         #0a0a12                   ││  │
│  │ S  │  │  Script  │      Monaco Editor                ││  │
│  │ I  │  │  List    │                                   ││  │
│  │ D  │  │          │  Syntax highlighting is the       ││  │
│  │ E  │  │ ┌──────┐ │  ONLY multi-color zone — a       ││  │
│  │ B  │  │ │▍item │ │  portal to color inside the      ││  │
│  │ A  │  │ │orange│ │  duotone world                   ││  │
│  │ R  │  │ │bar   │ │                                  ││  │
│  │    │  │ └──────┘ │  Everything else:                 ││  │
│  │ ic │  │          │  INDIGO + ORANGE only             ││  │
│  │ on │  │ ┌──────┐ │                                   ││  │
│  │ s  │  │ │ item │ │  ┌────────────────┐               ││  │
│  │ in │  │ └──────┘ │  │ ██ Compile ██  │ ← #ff6b2b   ││  │
│  │ or │  │          │  └────────────────┘               ││  │
│  │ ng │  └──────────┴───────────────────────────────────┘│  │
│  └────┴──────────────────────────────────────────────────┘  │
│                                                             │
│  RULE: If it's not indigo-black and not orange, it          │
│  doesn't exist in the chrome. Only the editor gets color.   │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparison Matrix

| Criteria           | Matte Terminal    | Nordic Signal   | Warm Carbon    | Graphite Studio  | Ink & Paper        | Obsidian Mono      | Duotone Forge    |
| ------------------ | ----------------- | --------------- | -------------- | ---------------- | ------------------ | ------------------ | ---------------- |
| **Mode**           | Dark              | Dark            | Dark           | Mid-tone         | Light              | Ultra-dark         | Dark             |
| **Surfaces**       | Pure neutral grey | Cool slate blue | Warm brown     | Neutral grey     | Warm off-white     | Pure neutral black | Indigo-tinted    |
| **Accent**         | Amber `#e5a000`   | Teal `#22d3ee`  | Gold `#d4a054` | Violet `#7c6aef` | Ink blue `#2955a0` | White `#ffffff`    | Orange `#ff6b2b` |
| **Blur/Glass**     | None              | None            | None           | None             | None               | None               | None             |
| **Shadows**        | None              | None            | 1 hairline     | None             | None               | None               | 1 subtle glow    |
| **Animations**     | 2                 | 5               | 4              | 5                | 2                  | 1                  | 5                |
| **Border-radius**  | 4px               | 4px             | 4px            | 4px              | **0px**            | 4px                | 4px              |
| **Uniqueness**     | High              | Medium-High     | High           | Medium           | Very High          | Very High          | Very High        |
| **Warmth**         | Neutral           | Cool            | Very warm      | Neutral          | Warm               | Cold               | Mixed            |
| **Density**        | High              | Medium          | Medium         | Medium           | Medium             | High               | Medium           |
| **Render cost**    | Minimal           | Minimal         | Minimal        | Minimal          | Minimal            | Minimal            | Minimal          |
| **Brand strength** | Strong            | Medium          | Strong         | Medium           | Very strong        | Very strong        | Very strong      |

### Performance Tier (all themes)

Every theme in this document eliminates:

- `backdrop-filter: blur()` (previously 6 instances)
- `filter: blur()` on pseudo-elements (previously 3 instances)
- Multi-stop gradient backgrounds
- Continuous keyframe animations on large elements
- `box-shadow` on hover/active states (except minimal exceptions noted)
- `transition: all` anti-pattern

**Estimated rendering improvement**: 40–60% reduction in composite layers, near-elimination of GPU-bound painting operations during idle state. Scroll and resize performance should improve noticeably.

---

## Recommendation for Next Steps

1. **Pick 1–2 candidates** that resonate with the intended brand direction
2. **Prototype the token files** — update `_primitives.scss` and `_semantic.scss` for the chosen theme and evaluate in-browser
3. **Test on Monaco** — verify syntax highlighting contrast ratios against the new surface colors
4. **Validate accessibility** — run WCAG 2.1 AA checks on all text/surface combinations
5. **Iterate** — refine based on real component rendering, adjusting token values until the hierarchy feels right
