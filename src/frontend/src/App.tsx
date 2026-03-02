import { Toaster } from "@/components/ui/sonner";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Division } from "./backend.d.ts";
import { DivisionView } from "./components/DivisionView";
import { Sidebar } from "./components/Sidebar";
import { useActor } from "./hooks/useActor";
import { useListDivisions, useSeedSampleData } from "./hooks/useQueries";

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const { data: divisions, isLoading: divisionsLoading } = useListDivisions();
  const { mutate: seedSampleData } = useSeedSampleData();
  const seededRef = useRef(false);

  const [selectedDivisionId, setSelectedDivisionId] = useState<bigint | null>(
    null,
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Seed sample data on first load if no divisions
  useEffect(() => {
    if (
      !actorFetching &&
      actor &&
      !divisionsLoading &&
      divisions !== undefined &&
      divisions.length === 0 &&
      !seededRef.current
    ) {
      seededRef.current = true;
      seedSampleData(undefined, {
        onSuccess: () => {
          toast.success("Sample data loaded — explore the demo!");
        },
      });
    }
  }, [actorFetching, actor, divisionsLoading, divisions, seedSampleData]);

  // Auto-select first division
  useEffect(() => {
    if (divisions && divisions.length > 0 && selectedDivisionId === null) {
      setSelectedDivisionId(divisions[0].id);
    }
  }, [divisions, selectedDivisionId]);

  const handleSelectDivision = (division: Division) => {
    setSelectedDivisionId(division.id);
  };

  const handleDivisionDeleted = (id: bigint) => {
    if (selectedDivisionId === id) {
      setSelectedDivisionId(null);
    }
  };

  const handleDivisionImported = (firstId: bigint) => {
    setSelectedDivisionId(firstId);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.18 0.012 250)",
            border: "1px solid oklch(0.28 0.015 250)",
            color: "oklch(0.94 0.01 80)",
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar
        divisions={divisions ?? []}
        selectedDivisionId={selectedDivisionId}
        onSelectDivision={handleSelectDivision}
        onDivisionDeleted={handleDivisionDeleted}
        onDivisionImported={handleDivisionImported}
        isLoading={divisionsLoading || actorFetching}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {selectedDivisionId !== null ? (
            <motion.div
              key={selectedDivisionId.toString()}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex-1 overflow-auto"
            >
              <DivisionView
                divisionId={selectedDivisionId}
                onSidebarToggle={() => setSidebarOpen((v) => !v)}
                sidebarOpen={sidebarOpen}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <img
                    src="/assets/generated/karate-logo-transparent.dim_80x80.png"
                    alt="Karate"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground">
                  No Division Selected
                </h2>
                <p className="text-muted-foreground max-w-xs">
                  Select a division from the sidebar or create a new one to
                  start building your bout chart.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
