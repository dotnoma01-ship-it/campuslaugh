import { HashRouter } from "react-router-dom";
import { StoreProvider } from "@/context/StoreContext";
import { SystemProvider } from "@/context/SystemContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppShell, { BootScreen } from "@/layouts/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <SystemProvider>
        <StoreProvider>
          <HashRouter>
            <BootScreen />
            <AppShell />
          </HashRouter>
        </StoreProvider>
      </SystemProvider>
    </ThemeProvider>
  );
}
