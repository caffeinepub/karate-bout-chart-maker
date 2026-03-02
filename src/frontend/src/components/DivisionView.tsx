import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  GitBranch,
  Loader2,
  Menu,
  RefreshCw,
  RotateCcw,
  Trophy,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Bout, Competitor } from "../backend.d.ts";
import {
  useGenerateBracket,
  useGetDivisionWithBouts,
  useResetBracket,
} from "../hooks/useQueries";
import { exportToExcel } from "../utils/exportExcel";
import { BracketView } from "./BracketView";
import { CompetitorsPanel } from "./CompetitorsPanel";

interface DivisionViewProps {
  divisionId: bigint;
  onSidebarToggle: () => void;
  sidebarOpen: boolean;
}

export function DivisionView({
  divisionId,
  onSidebarToggle,
  sidebarOpen,
}: DivisionViewProps) {
  const [activeTab, setActiveTab] = useState<"competitors" | "bracket">(
    "competitors",
  );

  const { data, isLoading } = useGetDivisionWithBouts(divisionId);
  const generateMutation = useGenerateBracket();
  const resetMutation = useResetBracket();

  const hasBracket = (data?.bouts?.length ?? 0) > 0;
  const competitorCount = data?.competitors?.length ?? 0;

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync(divisionId);
      toast.success("Bracket generated!");
      setActiveTab("bracket");
    } catch {
      toast.error("Failed to generate bracket");
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(divisionId);
      toast.success("Bracket reset");
      setActiveTab("competitors");
    } catch {
      toast.error("Failed to reset bracket");
    }
  };

  const handleExport = () => {
    if (!data) return;
    const competitorMap = new Map<string, Competitor>(
      data.competitors.map((c) => [c.id.toString(), c]),
    );
    exportToExcel({
      division: data.division,
      bouts: data.bouts,
      competitorMap,
    });
    toast.success("Excel file downloaded");
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {["sk1", "sk2", "sk3", "sk4", "sk5"].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Division not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-start gap-4">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5 flex-shrink-0"
              onClick={onSidebarToggle}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-display font-bold text-foreground truncate">
                {data.division.name}
              </h2>
              <Badge
                variant="outline"
                className="border-primary/40 text-primary text-xs"
              >
                {data.division.weightClass}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {competitorCount} competitor{competitorCount !== 1 ? "s" : ""}
              </span>
              {hasBracket && (
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  {data.bouts.length} bout{data.bouts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasBracket && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-2 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent hover:border-accent/60"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export Excel</span>
              </Button>
            )}
            {hasBracket ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/60"
              >
                {resetMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Reset Bracket</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={competitorCount < 2 || generateMutation.isPending}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Generate Bracket
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "competitors" | "bracket")}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <div className="px-6 pt-3 flex-shrink-0">
            <TabsList className="bg-secondary/60 border border-border h-9">
              <TabsTrigger
                value="competitors"
                className="text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Competitors
              </TabsTrigger>
              <TabsTrigger
                value="bracket"
                className="text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                <Trophy className="h-3.5 w-3.5 mr-1.5" />
                Bracket
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="competitors"
            className="flex-1 overflow-auto m-0 p-6 pt-4"
          >
            <CompetitorsPanel
              divisionId={divisionId}
              weightClass={data.division.weightClass}
              competitors={data.competitors}
              hasBracket={hasBracket}
              onGenerateBracket={handleGenerate}
              isGenerating={generateMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="bracket" className="flex-1 overflow-auto m-0">
            {hasBracket ? (
              <BracketView
                bouts={data.bouts}
                competitors={data.competitors}
                divisionId={divisionId}
                divisionName={data.division.name}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full gap-6 p-8"
              >
                <div className="w-20 h-20 rounded-full bg-muted/40 border border-border flex items-center justify-center">
                  <GitBranch className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-display font-semibold text-lg text-foreground">
                    No Bracket Generated
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {competitorCount < 2
                      ? "Add at least 2 competitors to generate a bracket."
                      : "Generate the bracket to start the tournament."}
                  </p>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={competitorCount < 2 || generateMutation.isPending}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Generate Bracket
                </Button>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
