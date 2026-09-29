# CRM — Frontend Standards

**Role:** Whoever writes CRM frontend code is a Senior Front-End Engineer & Web Architect. Output is production-ready. Every line adheres to web accessibility standards (WCAG 2.2) and the project's real styling stack.

**Stack of record (do not switch without Charlie's approval):**
Next.js App Router · TypeScript strict · **Tailwind CSS + shadcn/ui**. `cn()` helper at `apps/web/src/lib/utils.ts` (clsx + tailwind-merge). Design tokens are HSL CSS variables in `apps/web/src/app/globals.css` and `tailwind.config.ts`.

> The accessibility and semantic-HTML rules below are **hard requirements** — they hold on every stack. The styling rules describe *this* project (Tailwind + shadcn), not generic BEM. We do **not** use BEM in the app.

---

## 1. HTML semantics (hard requirement)

1. **Use semantic HTML5, not generic containers.** Reach for `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, `<figure>`, `<button>`, `<time>` where they carry meaning. A `<div>`/`<span>` is only correct when no semantic element fits (pure layout/styling hooks).
2. **Interactive = the right element.** Clickable things are `<button>` or `<a>`, never a `<div>` with an `onClick`. Use `<a>` for navigation (has an `href`), `<button>` for actions.
3. **One `<main>` per page.** Landmarks (`<nav>`, `<main>`, `<aside>`, `<footer>`) are unique and meaningful so assistive tech can navigate by region.
4. **`<section>` needs a heading.** Use `<section>` for a distinct thematic grouping of content, and give it a visible heading (`<h2>`+). Don't reach for `<section>` just because a visual band/wrapper exists — a plain `<div>` is correct when there's no heading and no distinct topic.
5. **`<article>` for independent content.** Product cards, brand/testimonial cards, order entries, blog/case-study items — anything that could stand alone or be reused independently — use `<article>`, not `<div>`.
6. **Lists are `<ul>`/`<ol>`, even when styled as a grid.** If content is semantically a list (features, reasons, cards from a `.map()`), wrap it in `<ul>`/`<li>` — CSS Grid/Flexbox still does the visual layout. A `.map()` producing `<div>`s that's conceptually a list is a semantic miss.

## 2. Heading hierarchy (hard requirement)

1. **Exactly one `<h1>` per page** — the page's subject.
2. **Never skip levels for visual styling.** `h1 → h2 → h3` in strict downward order. If you want a small-looking heading, keep the correct level and style it with Tailwind — do not drop to a lower level to shrink text.
3. Headings describe structure, not appearance.

## 3. Accessibility — WCAG 2.2 (hard requirement)

1. **Images:** every `<img>` / `next/image` has descriptive `alt`. Decorative-only images use `alt=""` (empty, not omitted).
2. **ARIA where required, not by reflex.** Prefer native semantics first; add ARIA only when native HTML can't express the state. Common ones: `aria-expanded` on disclosure/menu triggers, `aria-label`/`aria-labelledby` on icon-only controls, `aria-current` for the active nav item, `aria-live` for async status, `aria-hidden` on decorative icons.
3. **Every form control has a programmatic label** (`<label htmlFor>` or `aria-label`). Errors are associated via `aria-describedby` and announced.
4. **Keyboard first.** Every interactive element is reachable and operable by keyboard, focus order is logical, and focus is never trapped. Visible focus states stay on — do not remove outlines without an equal-or-better replacement.
5. **Contrast + targets:** meet WCAG 2.2 AA contrast; interactive targets are adequately sized (2.2 target-size guidance).
6. **Icon-only buttons** always carry an accessible name (`aria-label`) and their SVG is `aria-hidden="true"`.
7. **Images carry real dimensions.** Use `next/image`, or explicit `width`/`height` on a raw `<img>`, so the browser reserves space up front and avoids layout shift. Decorative images get `alt=""` (empty, not omitted) — never meaningless alt text (`alt="image"`, `alt="photo"`).
8. **Forms use the right input `type`** (`email`, `tel`, `url`, `number`, `date`, …) and surface validation, loading, and success states. Don't make a form's baseline usability depend on JavaScript when native HTML validation already covers the case.
9. **Respect `prefers-reduced-motion`** for any animation beyond a subtle micro-interaction.

## 4. Styling — Tailwind + shadcn (this project)

1. **Utility-first, co-located.** Style in the `className` with Tailwind utilities next to the markup. No parallel `.css`/`.scss` files, no BEM class names (`.card__title--featured`), no hand-written component stylesheets.
2. **Conditional/merged classes go through `cn()`** (`apps/web/src/lib/utils.ts`). Never string-concatenate class names by hand.
   ```tsx
   <button className={cn("rounded-md px-4 py-2", isActive && "bg-primary text-primary-foreground")} />
   ```
3. **Variants = `cva()`, not modifier strings.** When a component has visual variants (the old BEM "modifier" role), express them with `class-variance-authority` and typed props (`variant`, `size`), the shadcn way — compiler-checked, not a naming convention.
4. **Reuse before authoring.** Check for an existing shadcn/ui component before building new UI. Compose primitives; extract a React component when markup repeats — that is our unit of reuse, not a CSS block.
5. **Theme through tokens, never hardcode.** Use semantic token classes (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`). Do **not** hardcode hex colors or raw values that a token already covers — this is what lets the planned UI/UX re-skin change themes without touching markup.
6. **A fixed literal background must carry a fixed literal text color — never an inherited token.** Status banners/badges/toasts (`bg-amber-50`, `bg-green-50`, `bg-yellow-50`, etc.) are a legitimate, narrow exception to rule 5 — they're semantic-status colors, not themed surfaces, and correctly stay the same in light and dark mode. But a token text color (`text-foreground`, `text-muted-foreground`) on top of one is a real bug: those tokens flip to near-white in dark mode while the literal background stays a light pastel, producing unreadable contrast. Pair every such element with its own fixed shade from the same hue (established convention: `bg-*-50` + `text-*-700` or `text-*-800`, e.g. `bg-amber-50 text-amber-800`) — never let it inherit. This exact bug recurred four times across PR #146 (a toast + three status panels) before being caught; it's easy to introduce and easy to miss in light-mode-only testing.
7. **Keep specificity flat.** No `!important`, no deep descendant overrides, no fighting shadcn defaults with ad-hoc CSS. Adjust via utilities or the token layer.
8. **Mobile-first, always.** Write the unprefixed (base) classes for the small-screen layout first, then layer `sm:`/`md:`/`lg:` for larger breakpoints — never the reverse. Prefer fluid sizing (`max-w-*` + `w-full`) over fixed pixel widths, and avoid horizontal overflow (wrap or truncate, don't let content force a scrollbar). Dark mode follows the same variant pattern via `dark:`, not bespoke media queries.
9. **Grid vs Flexbox — choose by dimensionality.** Two-dimensional layouts (card grids, product grids, galleries) use CSS Grid (`grid grid-cols-N gap-N`). One-dimensional stacks or rows (a heading+paragraph block, a button row, nav items) use Flexbox (`flex flex-col`/`flex-row gap-N`). Don't fake a grid with wrapped flex items, and don't reach for Grid on a simple vertical stack.
10. **Spacing: `gap` over margin chains.** Inside a `flex`/`grid` parent, space children with `gap-N` on the parent, not `mt-N`/`mb-N` scattered across each child. Margin chains drift silently when children get reordered, added, or removed; `gap` doesn't. Reserve child margins for spacing against something outside the flex/grid flow.
11. **No orphaned trailing words.** `globals.css`'s base layer already sets `text-wrap: balance` on all headings and `text-wrap: pretty` on all paragraphs — this is automatic, don't override it per-component. If a specific paragraph still ends on a short trailing line, adjust its `max-w-*` before rewriting the copy or reaching for `text-balance` on long-form text (browsers cap `balance`'s effectiveness and get expensive past a few lines, which is why it's reserved for headings).

### Narrow exception — transactional email

HTML email can't run Tailwind. There, inline styles (or a scoped, flat class block) are acceptable. This is the **only** context where the utility-first rule is relaxed — it does not apply to any app UI.

## 5. TypeScript / component conventions

- **Strict TypeScript.** No `any` without a justifying comment (per proposal hard constraints).
- **Server Components by default;** add `"use client"` only when interactivity requires it.
- **Default to no comments** — add one only when the *why* is non-obvious.

---

## Self-check before finishing frontend work

- [ ] Semantic elements used; `<div>`/`<span>` only for genuine layout hooks
- [ ] Every `<section>` has a heading; independent/reusable content uses `<article>`; semantic lists use `<ul>`/`<ol>` even when grid-styled
- [ ] Exactly one `<h1>`; no skipped heading levels
- [ ] All images have `alt` and explicit dimensions (`next/image` or `width`/`height`); icon-only controls have `aria-label`; decorative SVGs `aria-hidden`
- [ ] Keyboard-operable; visible focus preserved; form controls labeled with correct input `type`s and validation/loading/success states
- [ ] Styled with Tailwind + `cn()`; variants via `cva()`; no BEM, no stray CSS files
- [ ] Semantic tokens used — no hardcoded colors/values a token covers
- [ ] Any fixed literal background (status banner/badge/toast) pairs with its own fixed literal text color, never an inherited token
- [ ] Mobile-first; Grid for 2D layouts, Flexbox for 1D stacks; `gap` used over margin chains on flex/grid children
- [ ] Reused existing shadcn/ui components where possible

When delivering a non-trivial piece of UI, add a short **3-bullet summary** justifying the key semantic-element choices and any accessibility decisions.
