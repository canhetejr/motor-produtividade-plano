# Login redesign QA

- Source visual truth: user-provided login reference image in this conversation.
- Implementation target: `/login`.
- Intended viewport: desktop, 1698 × 926 CSS px (the reference image dimensions).
- Intended state: initial login screen, dark theme, empty inputs.

## Evidence and result

The implementation could not be browser-rendered in this environment. The local dev server returns HTTP 500 before the login route because the Supabase URL and key are not configured. The available browser automation command (`agent-browser`) is also unavailable in this workspace. Consequently, an implementation screenshot, same-viewport comparison, interaction test, and console-error check cannot be produced.

Static validation completed:

- `npm run lint`: passed with pre-existing warning plus two Next image optimization warnings for supplied SVG logo assets; no errors.
- `git diff --check`: passed.
- The login form retains its existing server actions (`login` and `loginComGoogle`) and password visibility control.

## Required fidelity surfaces

- Fonts and typography: implemented from the existing Sora/JetBrains Mono design system; visual comparison blocked.
- Spacing and layout rhythm: implemented as a 54/46 split layout with an aligned centered form; visual comparison blocked.
- Colors and tokens: deep-space base, violet glow, mint divider and supplied brand assets applied; visual comparison blocked.
- Image quality and asset fidelity: official supplied Vértice SVG assets are used; visual comparison blocked.
- Copy and content: matches the supplied reference copy; visual comparison blocked.

## Findings

- [P1] Visual verification is blocked.
  Evidence: `/login` responds 500 without the required Supabase environment values; browser automation binary is unavailable.
  Impact: no browser-rendered screenshot can be compared to the visual source.
  Fix: provide the local Supabase environment configuration and a browser-capable verification tool, then capture `/login` at 1698 × 926 and complete the comparison.

## Implementation checklist

- [x] Recompose the desktop login into marketing and authentication panels.
- [x] Use the supplied horizontal and vertical Vértice brand assets.
- [x] Retain email/password, visibility toggle, Google action, error handling, and server actions.
- [ ] Capture and visually compare the running route once environment configuration is available.

final result: blocked

---

# Design QA — Minha semana

- Source visual truth: screenshots supplied by the user in the conversation (current dark “Minha semana” list and Google Calendar event detail).
- Implementation: `app/(app)/minha-semana/page.tsx` and `app/(app)/minha-semana/gestor-demandas.tsx`.
- Intended viewport: desktop, matching the supplied 1649×861 list screenshot; responsive dialog also implemented for narrow viewports.
- Source pixels: 1649×861 for the main list screenshot and 987×485 for the Google Calendar detail screenshot.
- Implementation pixels/CSS size/density: unavailable; no browser capture could be produced.
- State: authenticated gestor, “Minha semana” with creation dialog open.

## Full-view comparison evidence

Blocked. The available `agent-browser` verification skill could be loaded, but its CLI is not installed in this workspace (`agent-browser: command not found`). The local runtime also has no Supabase URL/key, so the authenticated route cannot be rendered with the remaining HTTP-only tools.

## Focused region comparison evidence

Blocked for the same reason. The intended focused regions were the header actions, board/step selectors, one demand row, and the automatic-sync notice.

## Findings

- No code-level P0/P1/P2 issue remains after TypeScript, ESLint, and production-build checks.
- Visual fidelity, modal overflow, responsive reflow, focus order, and the authenticated primary interaction still require browser-rendered evidence.

## Comparison history

- No valid visual iteration could start because the implementation screenshot is unavailable.

## Primary interactions tested

- Static/type validation only: manager-only rendering, single/batch payload construction, server validation, Google payload generation, and production compilation.
- Browser interactions: not tested; browser runner unavailable.
- Console errors: not checked in a browser; production build completed without errors.

final result: blocked
