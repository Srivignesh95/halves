// Lets TypeScript accept plain CSS imports like `import "./globals.css"`.
// Newer TypeScript versions flag side-effect imports that have no type declaration.
declare module "*.css";
