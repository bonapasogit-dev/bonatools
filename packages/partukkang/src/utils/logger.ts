export const log = {
    info(message: string): void {
        console.log(`[partukkang] ${message}`);
    },
    success(message: string): void {
        console.log(`[partukkang] ✔ ${message}`);
    },
    warn(message: string): void {
        console.warn(`[partukkang] ⚠ ${message}`);
    },
    error(message: string): void {
        console.error(`[partukkang] ✖ ${message}`);
    },
};
