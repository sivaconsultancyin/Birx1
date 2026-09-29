// Compatibility entrypoint. The production Aviator screen lives in src/screens.
// Keep a single production UI implementation so the reference UI cannot diverge.
export { AviatorScreen as default, AviatorScreen } from '../../../src/screens/AviatorScreen.tsx';
