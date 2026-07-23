import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".playwright-cli/**",
      ".venv-*/**",
      "next-env.d.ts",
      "node_modules/**",
      "output/**",
      "public/sw.js",
      "scripts/**/*.cjs"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "import/no-anonymous-default-export": "off"
    }
  }
];

export default eslintConfig;
