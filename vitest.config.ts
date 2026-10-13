import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test nằm NGOÀI assets/ — Cocos biên dịch mọi thứ trong assets/scripts/ vào bundle,
        // test không được lọt vào build game (cùng lý do với tools/ — xem 04 — mục 2).
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
});
