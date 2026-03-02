import { Crown, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Bout, Competitor } from "../backend.d.ts";
import { BoutCard } from "./BoutCard";

interface BracketViewProps {
  bouts: Bout[];
  competitors: Competitor[];
  divisionId: bigint;
  divisionName: string;
}

function getRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound) return "Final";
  if (round === maxRound - 1) return "Semifinals";
  if (round === maxRound - 2) return "Quarterfinals";
  return `Round ${round}`;
}

export function BracketView({
  bouts,
  competitors,
  divisionId,
  divisionName,
}: BracketViewProps) {
  const [selectedBoutId, setSelectedBoutId] = useState<bigint | null>(null);

  const competitorMap = useMemo(
    () =>
      new Map<string, Competitor>(competitors.map((c) => [c.id.toString(), c])),
    [competitors],
  );

  // Group bouts by round
  const rounds = useMemo(() => {
    const map = new Map<number, Bout[]>();
    for (const bout of bouts) {
      const round = Number(bout.round);
      if (!map.has(round)) map.set(round, []);
      map.get(round)!.push(bout);
    }
    // Sort each round's bouts by boutNumber
    for (const [, roundBouts] of map) {
      roundBouts.sort((a, b) => Number(a.boutNumber) - Number(b.boutNumber));
    }
    // Sort rounds ascending
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [bouts]);

  const maxRound = rounds.length > 0 ? rounds[rounds.length - 1][0] : 1;

  // Find champion
  const finalRoundBouts = rounds.find(([r]) => r === maxRound)?.[1] ?? [];
  const finalBout = finalRoundBouts[0];
  const champion =
    finalBout?.winnerId !== undefined && finalBout.winnerId !== null
      ? competitorMap.get(finalBout.winnerId.toString())
      : null;

  return (
    <div className="p-6 overflow-x-auto">
      {/* Champion banner */}
      <AnimatePresence>
        {champion && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-6 flex items-center justify-center"
          >
            <div className="flex items-center gap-4 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-950/60 via-card to-amber-950/60 border border-gold/40 shadow-glow-gold">
              <Crown className="h-7 w-7 text-gold flex-shrink-0" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-gold/70 font-semibold">
                  Champion — {divisionName}
                </p>
                <p className="text-xl font-display font-bold text-gold">
                  {champion.name}
                </p>
                <p className="text-sm text-gold/60">{champion.dojo}</p>
              </div>
              <Crown className="h-7 w-7 text-gold flex-shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bracket grid */}
      <div className="flex gap-0 items-start min-w-max">
        {rounds.map(([round, roundBouts], roundIndex) => {
          const isLast = round === maxRound;
          const label = getRoundLabel(round, maxRound);

          return (
            <div key={round} className="flex flex-col">
              {/* Round label */}
              <div className="px-3 pb-3 text-center">
                <span
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    isLast ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Bouts column */}
              <div
                className="flex flex-col"
                style={{
                  // Space between bouts grows exponentially per round
                  gap: `${2 ** roundIndex * 16 + (roundIndex > 0 ? 2 ** (roundIndex - 1) * 80 : 0)}px`,
                  paddingTop:
                    roundIndex > 0 ? `${2 ** (roundIndex - 1) * 40}px` : "0",
                }}
              >
                {roundBouts.map((bout) => (
                  <div
                    key={bout.id.toString()}
                    className="relative flex items-center"
                  >
                    {/* Connector lines */}
                    {roundIndex > 0 && (
                      <div
                        className="absolute left-0 top-1/2 w-4 border-t border-border"
                        style={{ transform: "translateY(-50%)" }}
                      />
                    )}

                    <div className="pl-4">
                      <BoutCard
                        bout={bout}
                        competitorMap={competitorMap}
                        divisionId={divisionId}
                        isSelected={selectedBoutId === bout.id}
                        onSelect={() =>
                          setSelectedBoutId(
                            selectedBoutId === bout.id ? null : bout.id,
                          )
                        }
                        onResultRecorded={() => setSelectedBoutId(null)}
                      />
                    </div>

                    {/* Right connector */}
                    {!isLast && <div className="w-4 border-t border-border" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Trophy at end */}
        {rounds.length > 0 && (
          <div className="flex flex-col items-center justify-center pl-0 pt-8">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                champion
                  ? "bg-gold/10 border-gold/40"
                  : "bg-muted/30 border-border"
              }`}
              style={{
                marginTop: `${2 ** (rounds.length - 1) * 40 - 24}px`,
              }}
            >
              <Trophy
                className={`h-6 w-6 ${champion ? "text-gold" : "text-muted-foreground/30"}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
