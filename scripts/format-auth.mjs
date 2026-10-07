import { spawnSync } from "node:child_process";

const files = [
  "Backend/src",
  "Backend/scripts",
  "Backend/test",
  "Backend/package.json",
  "Backend/README.md",
  "tests",
  "scripts/format-auth.mjs",
  "src/lib/auth-contract.ts",
  "src/lib/backend.ts",
  "src/proxy.ts",
  "src/app/dang-nhap/dang-nhap-form.tsx",
  "src/app/(app)/layout.tsx",
  "src/app/(app)/quan-tri/vai-tro",
  "src/app/(app)/tong-quan",
  "src/app/(app)/du-lieu",
  "src/app/doi-mat-khau",
  "src/app/khong-co-quyen",
  "src/components/layout/app-header.tsx",
  "next.config.ts",
  "eslint.config.mjs",
  ".prettierrc.json",
  "package.json",
];
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prettier/bin/prettier.cjs",
    process.argv.includes("--write") ? "--write" : "--check",
    ...files,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
