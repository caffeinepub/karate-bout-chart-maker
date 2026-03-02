import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Division } from "../backend.d.ts";
import { useCreateDivision, useDeleteDivision } from "../hooks/useQueries";
import { ExcelImporter } from "./ExcelImporter";

interface SidebarProps {
  divisions: Division[];
  selectedDivisionId: bigint | null;
  onSelectDivision: (division: Division) => void;
  onDivisionDeleted: (id: bigint) => void;
  onDivisionImported: (firstId: bigint) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  divisions,
  selectedDivisionId,
  onSelectDivision,
  onDivisionDeleted,
  onDivisionImported,
  isLoading,
  isOpen,
  onToggle,
}: SidebarProps) {
  const [newDivisionOpen, setNewDivisionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Division | null>(null);
  const [divisionName, setDivisionName] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [excelImporterOpen, setExcelImporterOpen] = useState(false);

  const createMutation = useCreateDivision();
  const deleteMutation = useDeleteDivision();

  const handleCreate = async () => {
    if (!divisionName.trim() || !weightClass.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: divisionName.trim(),
        weightClass: weightClass.trim(),
      });
      toast.success(`Division "${divisionName}" created`);
      setDivisionName("");
      setWeightClass("");
      setNewDivisionOpen(false);
    } catch {
      toast.error("Failed to create division");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      onDivisionDeleted(deleteTarget.id);
      toast.success(`Division "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete division");
    }
  };

  return (
    <>
      <motion.aside
        animate={{ width: isOpen ? 260 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="relative flex-shrink-0 overflow-hidden border-r border-border bg-sidebar"
      >
        <div className="w-[260px] h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <img
                src="/assets/generated/karate-logo-transparent.dim_80x80.png"
                alt="Karate"
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm text-foreground leading-tight truncate">
                Karate Bout Chart
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Tournament Manager
              </p>
            </div>
          </div>

          {/* Divisions list */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Divisions
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              onClick={() => setNewDivisionOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2">
            {isLoading ? (
              <div className="space-y-1.5 p-2">
                {["s1", "s2", "s3", "s4"].map((k) => (
                  <Skeleton key={k} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : divisions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  No divisions yet.
                  <br />
                  Create one to begin.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 pb-4">
                {divisions.map((division) => (
                  <motion.div
                    key={division.id.toString()}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex items-center gap-1 rounded-md overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDivision(division)}
                      className={cn(
                        "flex-1 min-w-0 text-left px-3 py-2.5 rounded-md transition-colors",
                        selectedDivisionId === division.id
                          ? "bg-primary/15 text-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                            selectedDivisionId === division.id
                              ? "bg-primary"
                              : "bg-muted-foreground/30",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {division.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {division.weightClass}
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(division);
                      }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all mr-1"
                      title="Delete division"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* New Division / Import buttons at bottom */}
          <div className="p-3 border-t border-sidebar-border space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/60"
              onClick={() => setNewDivisionOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Division
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed border-accent/40 text-accent hover:bg-accent/10 hover:text-accent hover:border-accent/60"
              onClick={() => setExcelImporterOpen(true)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import from Excel
            </Button>
          </div>
        </div>
      </motion.aside>

      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 z-10 w-5 h-10 flex items-center justify-center bg-sidebar border border-border rounded-r-md hover:bg-sidebar-accent transition-colors"
        style={{
          left: isOpen ? 260 : 0,
          transition: "left 0.25s ease-in-out",
        }}
      >
        {isOpen ? (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* New Division Dialog */}
      <Dialog open={newDivisionOpen} onOpenChange={setNewDivisionOpen}>
        <DialogContent className="bg-popover border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">New Division</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new competition division.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="div-name">Division Name</Label>
              <Input
                id="div-name"
                placeholder="e.g. Male Adult Kumite"
                value={divisionName}
                onChange={(e) => setDivisionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight Class</Label>
              <Input
                id="weight"
                placeholder="e.g. Under 75kg"
                value={weightClass}
                onChange={(e) => setWeightClass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNewDivisionOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Division
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-popover border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Division?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete "{deleteTarget?.name}" and all its
              competitors and bout data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excel Importer */}
      <ExcelImporter
        open={excelImporterOpen}
        onOpenChange={setExcelImporterOpen}
        onImportComplete={(firstId) => {
          setExcelImporterOpen(false);
          onDivisionImported(firstId);
        }}
      />
    </>
  );
}
