/**
 * ESLint configuration.
 *
 * WHY THIS FILE IS .js AND NOT .json
 * The reasoning below is the kind that gets deleted and then rediscovered
 * the hard way, and JSON can't hold a comment.
 *
 * THE BUG THIS FIXES
 * `eslint-config-next` depends on `@typescript-eslint/parser` — so TypeScript
 * gets *parsed* — but it does NOT depend on
 * `@typescript-eslint/eslint-plugin`, which is what supplies the rule
 * *definitions*. Extending `next/core-web-vitals` therefore gives you TS
 * parsing with zero `@typescript-eslint/*` rules registered.
 *
 * Referencing one anyway — including inside an `eslint-disable` directive —
 * makes ESLint core report:
 *
 *     Definition for rule '@typescript-eslint/no-explicit-any' was not found
 *
 * That is an *error*, not a warning, and `next build` fails the build on
 * lint errors. So a single stray disable comment broke deployment.
 *
 * Registering the plugin below makes those rules resolvable.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  extends: 'next/core-web-vitals',
  rules: {
    // The gallery, hero and lightbox intentionally use <img>: they render
    // user-supplied and remote media at sizes next/image can't improve on
    // here, and the hero needs a plain <img> for its video fallback.
    '@next/next/no-img-element': 'off',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      /*
        Deliberately NOT extending `plugin:@typescript-eslint/recommended`.
        That switches on roughly thirty rules at once across an existing
        codebase, which is a separate reviewed change — not something to
        smuggle into a build fix. Only the rules actually worth enforcing
        today are listed, and both are warnings so they report without
        failing the build.
      */
      rules: {
        // Superseded by the TS-aware version, which understands types,
        // enums and parameter properties.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            // Needed for the `const { policyAccepted: _x, ...draft }` idiom
            // used to intentionally drop a field.
            ignoreRestSiblings: true,
          },
        ],
        // The rule whose absence caused the build failure. Now defined, so
        // any disable directive naming it resolves — and new `any`s get
        // flagged rather than passing silently.
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
}
