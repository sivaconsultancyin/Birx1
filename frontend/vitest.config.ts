import {defineConfig} from 'vitest';
export default defineConfig({test:{environment:'jsdom',include:['src/**/*.test.ts','src/**/*.test.tsx']}});