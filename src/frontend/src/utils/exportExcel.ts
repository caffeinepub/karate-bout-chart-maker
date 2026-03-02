import * as XLSX from "xlsx";
import type { Bout, Competitor, Division } from "../backend.d.ts";

interface ExportOptions {
  division: Division;
  bouts: Bout[];
  competitorMap: Map<string, Competitor>;
}

function getRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound) return "Final";
  if (round === maxRound - 1) return "Semifinals";
  if (round === maxRound - 2) return "Quarterfinals";
  return `Round ${round}`;
}

export function exportToExcel({
  division,
  bouts,
  competitorMap,
}: ExportOptions): void {
  const wb = XLSX.utils.book_new();

  // Sort bouts by round then boutNumber
  const sortedBouts = [...bouts].sort((a, b) => {
    const roundDiff = Number(a.round) - Number(b.round);
    if (roundDiff !== 0) return roundDiff;
    return Number(a.boutNumber) - Number(b.boutNumber);
  });

  const maxRound =
    sortedBouts.length > 0
      ? Math.max(...sortedBouts.map((b) => Number(b.round)))
      : 1;

  // Sheet data rows
  const rows: (string | number)[][] = [];

  // Title rows
  rows.push([division.name, "", "", "", ""]);
  rows.push([`Weight Class: ${division.weightClass}`, "", "", "", ""]);
  rows.push(["", "", "", "", ""]);

  // Header row
  rows.push(["Round", "Bout #", "Competitor 1", "Competitor 2", "Winner"]);

  // Data rows
  for (const bout of sortedBouts) {
    const comp1 = competitorMap.get(bout.competitor1Id.toString());
    const comp2 =
      bout.competitor2Id !== undefined && bout.competitor2Id !== null
        ? competitorMap.get(bout.competitor2Id.toString())
        : null;
    const winner =
      bout.winnerId !== undefined && bout.winnerId !== null
        ? competitorMap.get(bout.winnerId.toString())
        : null;

    rows.push([
      getRoundLabel(Number(bout.round), maxRound),
      Number(bout.boutNumber),
      comp1?.name ?? "TBD",
      comp2?.name ?? "BYE",
      winner?.name ?? "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 16 }, // Round
    { wch: 8 }, // Bout #
    { wch: 28 }, // Competitor 1
    { wch: 28 }, // Competitor 2
    { wch: 28 }, // Winner
  ];

  // Merge title cells
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Division name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Weight class
  ];

  // Sheet name: truncate to 31 chars (Excel limit)
  const sheetName = division.name.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Trigger download
  const fileName = `${division.name.replace(/[^a-zA-Z0-9\s-]/g, "").trim()}-bout-chart.xlsx`;
  XLSX.writeFile(wb, fileName);
}
