# The Design System: Architectural Guidelines for Premium Web3 Experiences

## 1. Overview & Creative North Star: "The Ethereal Vault"
This design system is built upon the "Ethereal Vault" North Star—a conceptual framework where high-stakes fintech security meets the boundless transparency of the blockchain. We move away from the "flat web" by treating the interface as a physical, multi-dimensional space. 

By leveraging intentional asymmetry, overlapping frosted surfaces, and dramatic typographic scales, we move beyond generic dashboard templates. The goal is to make the user feel as though they are interacting with a high-functioning AI intelligence, where every element is suspended in a deep-space vacuum, held together by gravitational gradients rather than rigid lines.

## 2. Color & Atmospheric Surface Hierarchy
Our color strategy is not about filling boxes; it is about managing light and depth within a dark-mode environment.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined through:
1. **Background Shifts:** Placing a `surface-container-low` component on top of a `surface` background.
2. **Tonal Transitions:** Using subtle shifts in saturation to indicate depth.
3. **Glass Refraction:** Using backdrop blurs to suggest a physical layer.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted obsidian. 
*   **Base Layer (`surface`):** The deep space foundation (#130921).
*   **Ambient Layers (`surface-container-low` to `surface-container-high`):** Use these to create "nested" depth. An inner card should always be one tier higher or lower than its parent to define importance without a shadow.
*   **The "Glass & Gradient" Rule:** Floating elements (modals, dropdowns, hovered cards) must use semi-transparent versions of `surface-variant` with a `backdrop-filter: blur(20px)`.

### Signature Textures
Main CTAs and Hero backgrounds should utilize a "Plasma Gradient" (transitioning from `primary` #99F7FF to `secondary` #C47FFF). This provides a visual "soul" that flat colors cannot achieve, mimicking the glow of a quantum processor.

---

## 3. Typography: The Editorial Contrast
We balance the geometric, tech-forward nature of Web3 with the legibility of high-end fintech.

*   **Display & Headline (Space Grotesk):** These are our "Architectural" fonts. Use `display-lg` (3.5rem) with tight tracking (-2%) to create a sense of monumental authority. Headlines should feel like labels on a futuristic blueprint—geometric, precise, and uncompromising.
*   **Body & Title (Manrope):** We have opted for Manrope as a sophisticated alternative to Satoshi to provide better rhythmic flow in dense data environments. Use `body-md` for primary content to ensure high-contrast legibility against dark surfaces.
*   **Labels (Space Grotesk):** All micro-copy, tags, and data points should use Space Grotesk `label-sm` in uppercase with +5% letter spacing to evoke a "NASA-spec" aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too heavy for this system. We use light and transparency to simulate elevation.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-high` section creates a "sunken" Neumorphic effect. A `surface-bright` card on a `surface` background creates a "raised" effect.
*   **Ambient Shadows:** When a floating effect is mandatory (e.g., a primary modal), use a shadow with a 40px–60px blur, at 6% opacity. The shadow color must be a tinted `secondary-fixed-dim` (#DDB3FF) to simulate the ambient purple glow of the environment.
*   **The "Ghost Border":** If a border is required for accessibility, it must be a "Ghost Border" using `outline-variant` at 15% opacity. Never use 100% opaque lines.
*   **Glassmorphism:** Use `surface-tint` at 5% opacity with a heavy blur for floating navigation bars. This allows the "Deep Space" background to bleed through, ensuring the UI feels integrated rather than "pasted on."

---

## 5. Components & Primitives

### Buttons: The "Light-Speed" Variants
*   **Primary:** A gradient fill from `primary` to `primary-dim`. Use `xl` (3rem) corner radius. On hover, add a subtle outer glow (0px 0px 15px) using the `primary` token.
*   **Secondary:** A "Ghost Border" button with `label-md` Space Grotesk text. No background fill unless hovered.
*   **Tertiary:** Text-only with a `primary` underline that expands from the center on hover.

### Floating Cards (The Staking Module)
*   **Rule:** Forbid divider lines.
*   **Style:** Use `2xl` (3rem) rounded corners. Background should be `surface-container-low` with a 10% opacity linear gradient border (top-left to bottom-right) using `primary` to `secondary`. This creates a "specular highlight" on the edge of the glass.

### Input Fields: The "Submerged" Style
*   **State:** Default inputs should use `surface-container-lowest` to look "carved" into the surface (Neumorphism). 
*   **Focus:** On focus, the "Ghost Border" transitions to a 100% opaque `primary` gradient border with a 4px soft outer glow.

### Additional Signature Components
*   **Staking Progress Rings:** Use `tertiary` (#A2FFBF) for success/growth metrics. The ring should have a "trailing" glow effect, as if the light is moving.
*   **Data Particles:** For background elements, use subtle 1px to 2px circles in `primary-fixed` at 20% opacity to simulate blockchain nodes.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. Let a card bleed off the grid or overlap a headline.
*   **Do** use extreme vertical whitespace. Give the data "room to breathe."
*   **Do** use `tertiary-container` (#00FD93) for all positive financial trends. It should feel like a neon signal in the dark.

### Don’t:
*   **Don't** use pure black (#000000) for backgrounds. It kills the depth. Always use `surface` (#130921).
*   **Don't** use standard 4px or 8px border radii. This system is defined by the `2xl` (3rem) and `xl` (2rem) scale to feel organic and premium.
*   **Don't** use more than two "Glass" layers on top of each other, or the blur will become muddy and lose its "frosted" quality.