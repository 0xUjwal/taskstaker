```markdown
# Design System Specification: Editorial Precision & High-Stakes Futurism

## 1. Overview & Creative North Star: "The Obsidian Razor"
This design system is engineered for the high-stakes world of Web3, where security, speed, and elite status are paramount. Our Creative North Star is **"The Obsidian Razor"**—a philosophy that marries the raw, unapologetic honesty of Neo-Brutalism with the sophisticated depth of High-End Glassmorphism.

We move beyond the "template" look by rejecting the standard grid in favor of **Intentional Asymmetry**. Large-scale typography acts as a structural element, while content blocks are treated as floating obsidian slabs. The interface should feel like a high-end surveillance terminal or a private financial vault: precise, intimidating, yet perfectly legible.

---

## 2. Colors & Surface Architecture
The palette is a ruthless hierarchy of Onyx, White, and Racing Red. Every color choice is binary: either it is structural (Black/White) or it is a signal of high-priority action (Red).

### Surface Hierarchy & Nesting
We do not use flat layouts. We use **Tonal Layering** to create a sense of physical hardware.
- **Base Layer:** `surface` (#131313) for the main application background.
- **The "Vault" Nesting:** To define a content area, place a `surface-container-low` (#1B1B1B) section on the base. Inside that, use `surface-container-highest` (#353535) for interactive cards. This creates depth through luminance rather than lines.
- **The "No-Line" Rule:** **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through background color shifts. If a section needs to end, change the surface tier.

### The Glass & Gradient Rule
To achieve the "Futuristic" vibe, use Glassmorphism for floating overlays (modals, dropdowns). Use `surface_variant` at 60% opacity with a `40px` backdrop blur. 
- **Signature Glows:** Use radial gradients of `primary_container` (#FF5540) at 10% opacity in the background corners to mimic hardware status lights.

---

## 3. Typography: The Editorial Command
Typography is the primary driver of the "Elite" feel. We use a high-contrast scale that prioritizes authority.

- **Display & Headlines (`Space Grotesk`):** This is our "Brutalist" anchor. Use `display-lg` (3.5rem) for hero sections with tight letter-spacing (-0.05em). Headlines should feel like commands—stark, white (`on_surface`), and massive.
- **Body & Technicals (`Inter`):** For data and descriptions, we switch to `Inter`. It provides the "Precision" feel. Use `body-md` (0.875rem) for high-density Web3 data to maintain a clean, technical aesthetic.
- **Visual Hierarchy:** Headlines should often be 3x the size of the body text to create an editorial, magazine-like layout.

---

## 4. Elevation & Depth: Tonal Layering
In this system, depth is a weapon. We do not use traditional "shadows" that look like soft clouds; we use "Ambient Tensions."

- **The Layering Principle:** Stack `surface-container-lowest` on `surface-container-high` to create a "recessed" look for input fields or data logs.
- **Ambient Shadows:** For floating elements, use a highly diffused shadow: `0px 24px 80px rgba(0, 0, 0, 0.5)`. This ensures the obsidian surfaces feel heavy and significant.
- **The Ghost Border Fallback:** If accessibility requires a border, use `outline_variant` at 15% opacity. It should be felt, not seen.
- **Radii:** All corners are `0px` (Sharp). This reinforces the "Brutal" and "Precision" feel of a secure protocol.

---

## 5. Components: Precision Primitive Styling

### Buttons
- **Primary:** Background: `primary_fixed` (#FFDAD4); Text: `on_primary_fixed` (#410000). Sharp corners. No gradient. On hover: Shift to `primary` (#FFB4A8).
- **Secondary:** Background: Transparent; Border: 2px solid `on_surface`; Text: `on_surface`.
- **Tertiary:** Text only, uppercase `label-md`, with a `primary` red underline (2px) that expands on hover.

### Input Fields
- **State:** Background: `surface_container_lowest`; Border: None; Bottom-border: 2px solid `outline_variant`.
- **Focus:** Bottom-border shifts to `primary` (#FFB4A8) with a subtle `primary_container` outer glow.

### Cards & Lists
- **The Separation Rule:** Forbid divider lines. Separate list items using `8px` of vertical white space or by alternating background colors between `surface_container_low` and `surface_container`.
- **Web3 Data Cells:** Use `surface_container_high` for the container. Text should be `title-sm` in `Space Grotesk` for the value, and `label-sm` in `Inter` for the label.

### Chips
- **Status Chips:** Small, rectangular, `0px` radius. Use `error_container` for "Critical" and `secondary_container` for "Neutral." No icons unless necessary for security.

---

## 6. Do’s and Don’ts

### Do:
- **Use Intentional Asymmetry:** Align text to the left and leave a massive "void" on the right for a premium editorial feel.
- **Over-index on White Space:** Premium design breathes. Use the `64px` spacing token between major sections.
- **Embrace the Red:** Use `primary` (#FFB4A8) for mission-critical information only. It should feel like an alert.

### Don’t:
- **No Rounded Corners:** Never use `border-radius`. This system is built on "Sharp Precision."
- **No Grey Text:** Avoid mid-grey. Use `on_surface_variant` (#EBBBB4) if you need a softer white, but keep contrast high for that "Elite" feel.
- **No Standard Grids:** Avoid placing three cards in a perfect row. Try two cards of unequal width (e.g., 60% / 40%) to break the "Bootstrap" look.

---

## 7. Designer’s Note on Soul
This system is not meant to be "friendly." It is meant to be **authoritative**. When designing a page, ask yourself: *"Does this look like a consumer app, or does it look like the control panel for a global financial shift?"* If it feels too safe, increase the font size contrast and remove more lines. Let the surfaces do the work.```