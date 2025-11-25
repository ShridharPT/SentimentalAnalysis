import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BookHeart } from "lucide-react";
import Index from "./pages/Index";
import Entries from "./pages/Entries";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen w-full flex gradient-soft">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              {/* Header with Menu Toggle */}
              <header className="sticky top-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-soft px-4 py-4">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="hover:bg-muted/50 transition-smooth" />
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg gradient-warm shadow-medium">
                      <BookHeart className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
                      MoodMate
                    </h1>
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/entries" element={<Entries />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
