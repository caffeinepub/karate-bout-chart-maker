import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { Bout, Competitor } from "../backend.d.ts";
import { useRecordResult } from "../hooks/useQueries";

interface BoutCardProps {
  bout: Bout;
  competitorMap: Map<string, Competitor>;
  divisionId: bigint;
  isSelected: boolean;
  onSelect: () => void;
  onResultRecorded: () => void;
}

export function BoutCard({
  bout,
  competitorMap,
  divisionId,
  isSelected,
  onSelect,
  onResultRecorded,
}: BoutCardProps) {
  const recordMutation = useRecordResult();

  const comp1 = competitorMap.get(bout.competitor1Id.toString());
  const comp2 =
    bout.competitor2Id !== undefined && bout.competitor2Id !== null
      ? competitorMap.get(bout.competitor2Id.toString())
      : null;

  const isBye = !comp2;
  const hasWinner = bout.winnerId !== undefined && bout.winnerId !== null;

  const canSelectWinner = !hasWinner && !isBye && !!comp1 && !!comp2;

  const handleSelectWinner = async (winnerId: bigint) => {
    try {
      await recordMutation.mutateAsync({
        boutId: bout.id,
        winnerId,
        divisionId,
      });
      toast.success(
        `Winner recorded: ${competitorMap.get(winnerId.toString())?.name}`,
      );
      onResultRecorded();
    } catch {
      toast.error("Failed to record result");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-52 rounded-lg border bg-card overflow-hidden transition-colors",
        isSelected ? "border-primary/60 shadow-glow" : "border-border",
        canSelectWinner &&
          "cursor-pointer hover:border-primary/40 hover:bg-card/80",
        hasWinner && "border-border/60",
      )}
      onClick={() => canSelectWinner && onSelect()}
    >
      {/* Bout header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <span className="text-xs font-mono text-muted-foreground">
          #{Number(bout.boutNumber)}
        </span>
        {isBye && (
          <span className="text-xs text-muted-foreground italic">BYE</span>
        )}
        {hasWinner && (
          <span className="text-xs text-gold flex items-center gap-1">
            <Check className="h-3 w-3" />
            Done
          </span>
        )}
        {canSelectWinner && (
          <span className="text-xs text-primary/60">click to score</span>
        )}
      </div>

      {/* Competitor 1 */}
      <CompetitorRow
        competitor={comp1 ?? null}
        isWinner={hasWinner && bout.winnerId === bout.competitor1Id}
        isLoser={
          hasWinner &&
          bout.winnerId !== null &&
          bout.winnerId !== undefined &&
          bout.winnerId !== bout.competitor1Id
        }
        canClick={isSelected && canSelectWinner}
        isLoading={
          recordMutation.isPending &&
          recordMutation.variables?.winnerId === bout.competitor1Id
        }
        onClick={() => {
          if (isSelected && canSelectWinner && comp1) {
            handleSelectWinner(bout.competitor1Id);
          }
        }}
      />

      {/* Divider */}
      <div className="h-px bg-border mx-3" />

      {/* Competitor 2 */}
      {isBye ? (
        <div className="px-3 py-2.5">
          <span className="text-xs text-muted-foreground italic">
            BYE — Automatic advance
          </span>
        </div>
      ) : (
        <CompetitorRow
          competitor={comp2 ?? null}
          isWinner={
            hasWinner &&
            bout.competitor2Id !== undefined &&
            bout.competitor2Id !== null &&
            bout.winnerId === bout.competitor2Id
          }
          isLoser={
            hasWinner &&
            bout.competitor2Id !== undefined &&
            bout.competitor2Id !== null &&
            bout.winnerId !== bout.competitor2Id
          }
          canClick={isSelected && canSelectWinner}
          isLoading={
            recordMutation.isPending &&
            bout.competitor2Id !== undefined &&
            bout.competitor2Id !== null &&
            recordMutation.variables?.winnerId === bout.competitor2Id
          }
          onClick={() => {
            if (
              isSelected &&
              canSelectWinner &&
              bout.competitor2Id !== undefined &&
              bout.competitor2Id !== null
            ) {
              handleSelectWinner(bout.competitor2Id);
            }
          }}
        />
      )}

      {/* Select winner prompt */}
      <AnimatePresence>
        {isSelected && canSelectWinner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-primary/20 bg-primary/5 px-3 py-2"
          >
            <p className="text-xs text-primary/80 text-center">
              Tap a competitor above to declare winner
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface CompetitorRowProps {
  competitor: Competitor | null;
  isWinner: boolean;
  isLoser: boolean;
  canClick: boolean;
  isLoading: boolean;
  onClick: () => void;
}

function CompetitorRow({
  competitor,
  isWinner,
  isLoser,
  canClick,
  isLoading,
  onClick,
}: CompetitorRowProps) {
  return (
    <button
      type="button"
      tabIndex={canClick ? 0 : -1}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left",
        isWinner && "bg-gold/10",
        isLoser && "opacity-40",
        canClick && "hover:bg-primary/10 cursor-pointer active:bg-primary/20",
        !canClick && "cursor-default",
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (canClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />
      ) : isWinner ? (
        <Check className="h-3.5 w-3.5 text-gold flex-shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        {competitor ? (
          <>
            <p
              className={cn(
                "text-sm truncate leading-tight",
                isWinner
                  ? "font-bold text-gold"
                  : "font-medium text-foreground",
              )}
            >
              {competitor.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {competitor.dojo}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">TBD</p>
        )}
      </div>
    </button>
  );
}
