import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ملاحظة: القواعد المُعاد تفعيلها ضُبطت على "warn" وليس "error"
// حتى لا تكسر البناء (next build لا يفشل مع التحذيرات).
// يُنصح بترقيتها تدريجياً إلى "error" بعد تنظيف التحذيرات الحالية.
const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules — أُبقيت معطلة لتجنب كسر البناء على الكود الحالي
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    // أُعيد تفعيلها كتحذيرات: كشف المتغيرات غير المستخدمة
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

    // React rules
    // أُعيد تفعيلها كتحذيرات: التبعيات الناقصة مصدر شائع للأخطاء
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules — أُعيد تفعيل الأساسيات كتحذيرات
    "prefer-const": "warn",
    "no-debugger": "warn",
    "no-unreachable": "warn",
    "no-empty": "warn",
    "no-fallthrough": "warn",
    "no-redeclare": "warn",
    "no-case-declarations": "warn",
    "no-useless-escape": "warn",
    // أُبقيت معطلة لتجنب ضجيج غير مفيد في هذا المشروع
    "no-console": "off",
    "no-unused-vars": "off",
    "no-irregular-whitespace": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-undef": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
