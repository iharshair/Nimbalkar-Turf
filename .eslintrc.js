/**
 * ESLint configuration.
 *
 * WHY THERE IS NO @typescript-eslint BLOCK HERE
 *
 * `eslint-config-next` depends on `@typescript-eslint/parser`, so TypeScript
 * is parsed correctly. It does NOT depend on
 * `@typescript-eslint/eslint-plugin`, which is what supplies the rule
 * *definitions*. Extending `next/core-web-vitals` therefore registers zero
 * `@typescript-eslint/*` rules.
 *
 * Naming one anywhere — in this config, or in an `eslint-disable` comment —
 * then produces:
 *
 *     Definition for rule '@typescript-eslint/no-explicit-any' was not found
 *
 * which ESLint reports as an *error*, and `next build` fails the build on
 * lint errors.
 *
 * Adding the plugin as a devDependency is not sufficient on its own: with no
 * lockfile committed, the install that Vercel actually performs is not
 * guaranteed to contain it, and the failure mode is this same error. The
 * dependable fix is for nothing to reference those rules at all.
 *
 * Nothing does. `src/` contains no `any` and no `@typescript-eslint` disable
 * directive, so no rule from that plugin is needed. Linting itself is fully
 * active: `next/core-web-vitals` covers React, hooks, a11y and the Next.js
 * rules, and every one of its errors still fails the build.
 *
 * To adopt those rules later, do it as its own change: commit a lockfile,
 * confirm `@typescript-eslint/eslint-plugin` is installed, then add the
 * plugin and its rules back and verify `npm run lint` locally first.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  extends: 'next/core-web-vitals',
  rules: {
    // The gallery, hero and lightbox intentionally use <img>: they render
    // remote and user-supplied media at sizes next/image can't improve on
    // here, and the hero needs a plain <img> for its video fallback.
    '@next/next/no-img-element': 'off',
  },
}
