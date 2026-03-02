import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Competitor } from "../backend.d.ts";
import { useAddCompetitor, useRemoveCompetitor } from "../hooks/useQueries";

const BELT_RANKS = [
  "White",
  "Yellow",
  "Orange",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Black (1st Dan)",
  "Black (2nd Dan)",
  "Black (3rd Dan)",
  "Black (4th Dan)",
  "Black (5th Dan)",
];

const BELT_COLORS: Record<string, string> = {
  White: "bg-gray-100 text-gray-800",
  Yellow: "bg-yellow-100 text-yellow-800",
  Orange: "bg-orange-100 text-orange-800",
  Green: "bg-green-100 text-green-800",
  Blue: "bg-blue-100 text-blue-800",
  Purple: "bg-purple-100 text-purple-800",
  Brown: "bg-amber-900/60 text-amber-100",
};

function getBeltBadgeClass(rank: string): string {
  return BELT_COLORS[rank] ?? "bg-gray-800 text-gray-100";
}

interface CompetitorsPanelProps {
  divisionId: bigint;
  weightClass: string;
  competitors: Competitor[];
  hasBracket: boolean;
  onGenerateBracket: () => void;
  isGenerating: boolean;
}

export function CompetitorsPanel({
  divisionId,
  weightClass,
  competitors,
  hasBracket,
  onGenerateBracket,
  isGenerating,
}: CompetitorsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [dojo, setDojo] = useState("");
  const [beltRank, setBeltRank] = useState("White");
  const [removingId, setRemovingId] = useState<bigint | null>(null);

  const addMutation = useAddCompetitor();
  const removeMutation = useRemoveCompetitor();

  const handleAdd = async () => {
    if (!name.trim() || !dojo.trim()) {
      toast.error("Name and dojo are required");
      return;
    }
    try {
      await addMutation.mutateAsync({
        name: name.trim(),
        dojo: dojo.trim(),
        beltRank,
        weightClass,
        divisionId,
      });
      toast.success(`${name.trim()} added`);
      setName("");
      setDojo("");
      setBeltRank("White");
    } catch {
      toast.error("Failed to add competitor");
    }
  };

  const handleRemove = async (competitor: Competitor) => {
    setRemovingId(competitor.id);
    try {
      await removeMutation.mutateAsync({
        id: competitor.id,
        divisionId,
      });
      toast.success(`${competitor.name} removed`);
    } catch {
      toast.error("Failed to remove competitor");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Competitor count + generate prompt */}
      {hasBracket && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
          <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Bracket is active. Reset it to add or remove competitors.</span>
        </div>
      )}

      {!hasBracket && competitors.length < 2 && competitors.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-accent-foreground">
          <Users className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
          <span>
            Add at least {2 - competitors.length} more competitor
            {2 - competitors.length !== 1 ? "s" : ""} to generate the bracket.
          </span>
        </div>
      )}

      {/* Add Competitor form toggle */}
      {!hasBracket && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showAddForm ? "secondary" : "outline"}
            className="gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/60"
            onClick={() => setShowAddForm((v) => !v)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {showAddForm ? "Hide Form" : "Add Competitor"}
          </Button>
          {competitors.length >= 2 && (
            <Button
              size="sm"
              onClick={onGenerateBracket}
              disabled={isGenerating}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Generate Bracket
            </Button>
          )}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && !hasBracket && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border border-border bg-card space-y-4">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add Competitor
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="comp-name" className="text-xs">
                    Full Name *
                  </Label>
                  <Input
                    id="comp-name"
                    placeholder="e.g. Miyagi Hiroshi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-input border-border h-9 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comp-dojo" className="text-xs">
                    Dojo *
                  </Label>
                  <Input
                    id="comp-dojo"
                    placeholder="e.g. Miyagi-Do Karate"
                    value={dojo}
                    onChange={(e) => setDojo(e.target.value)}
                    className="bg-input border-border h-9 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comp-belt" className="text-xs">
                    Belt Rank
                  </Label>
                  <Select value={beltRank} onValueChange={setBeltRank}>
                    <SelectTrigger
                      id="comp-belt"
                      className="bg-input border-border h-9 text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {BELT_RANKS.map((rank) => (
                        <SelectItem key={rank} value={rank} className="text-sm">
                          {rank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weight Class</Label>
                  <Input
                    value={weightClass}
                    disabled
                    className="bg-muted/30 border-border h-9 text-sm text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={addMutation.isPending}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add Competitor
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Competitors list */}
      {competitors.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-muted/30 border border-border flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-foreground">
              No Competitors Yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add competitors to start building your bracket.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/60"
            onClick={() => setShowAddForm(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add First Competitor
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {competitors.length} Competitor{competitors.length !== 1 ? "s" : ""}
          </div>
          <AnimatePresence>
            {competitors.map((competitor, index) => (
              <motion.div
                key={competitor.id.toString()}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8, height: 0 }}
                transition={{ delay: index * 0.04 }}
                className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-border/60 hover:bg-card/80 transition-colors"
              >
                {/* Seed number */}
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-mono font-semibold text-muted-foreground flex-shrink-0">
                  {index + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">
                      {competitor.name}
                    </span>
                    <Badge
                      className={`text-xs px-1.5 py-0 font-normal ${getBeltBadgeClass(competitor.beltRank)}`}
                    >
                      {competitor.beltRank}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {competitor.dojo}
                  </p>
                </div>

                {/* Remove button */}
                {!hasBracket && (
                  <button
                    type="button"
                    onClick={() => handleRemove(competitor)}
                    disabled={removingId === competitor.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                    title="Remove competitor"
                  >
                    {removingId === competitor.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
