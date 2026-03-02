import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useActor } from "../hooks/useActor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawCompetitor {
  name: string;
  dojo: string;
  beltRank: string;
  weight: number;
  gender: string;
  ageCategory: string;
}

interface WeightGroup {
  divisionName: string;
  weightLabel: string;
  gender: string;
  competitors: RawCompetitor[];
}

interface ImportProgress {
  current: number;
  total: number;
  status: string;
  error?: string;
}

type Step = "upload" | "preview" | "importing" | "done";

// ─── WKF Weight Categories ────────────────────────────────────────────────────

const MALE_CATEGORIES = [
  { label: "-60kg", min: 0, max: 60 },
  { label: "-67kg", min: 60, max: 67 },
  { label: "-75kg", min: 67, max: 75 },
  { label: "-84kg", min: 75, max: 84 },
  { label: "+84kg", min: 84, max: Number.POSITIVE_INFINITY },
];

const FEMALE_CATEGORIES = [
  { label: "-50kg", min: 0, max: 50 },
  { label: "-55kg", min: 50, max: 55 },
  { label: "-61kg", min: 55, max: 61 },
  { label: "-68kg", min: 61, max: 68 },
  { label: "+68kg", min: 68, max: Number.POSITIVE_INFINITY },
];

const OPEN_CATEGORIES = [
  { label: "Under 50kg", min: 0, max: 50 },
  { label: "50-60kg", min: 50, max: 60 },
  { label: "60-70kg", min: 60, max: 70 },
  { label: "70-80kg", min: 70, max: 80 },
  { label: "80+kg", min: 80, max: Number.POSITIVE_INFINITY },
];

function detectGender(raw: string): "male" | "female" | "open" {
  const v = raw.toLowerCase().trim();
  if (["m", "male", "man", "boy"].includes(v)) return "male";
  if (["f", "female", "woman", "girl"].includes(v)) return "female";
  return "open";
}

function categorizeCompetitor(competitor: RawCompetitor): {
  divisionName: string;
  weightLabel: string;
} {
  const gender = detectGender(competitor.gender);
  const weight = competitor.weight;

  if (gender === "male") {
    const cat =
      MALE_CATEGORIES.find((c) => weight > c.min && weight <= c.max) ||
      MALE_CATEGORIES[MALE_CATEGORIES.length - 1];
    return {
      divisionName: `Male ${cat.label}`,
      weightLabel: cat.label,
    };
  }
  if (gender === "female") {
    const cat =
      FEMALE_CATEGORIES.find((c) => weight > c.min && weight <= c.max) ||
      FEMALE_CATEGORIES[FEMALE_CATEGORIES.length - 1];
    return {
      divisionName: `Female ${cat.label}`,
      weightLabel: cat.label,
    };
  }
  const cat =
    OPEN_CATEGORIES.find((c) => weight > c.min && weight <= c.max) ||
    OPEN_CATEGORIES[OPEN_CATEGORIES.length - 1];
  return {
    divisionName: cat.label,
    weightLabel: cat.label,
  };
}

// ─── Column mapping (case-insensitive) ────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string> = {
  // Name
  name: "name",
  "competitor name": "name",
  athlete: "name",
  // Dojo
  club: "dojo",
  dojo: "dojo",
  team: "dojo",
  organization: "dojo",
  organisation: "dojo",
  // Belt
  belt: "beltRank",
  "belt rank": "beltRank",
  grade: "beltRank",
  kyu: "beltRank",
  dan: "beltRank",
  // Weight
  weight: "weight",
  "weight (kg)": "weight",
  kg: "weight",
  "body weight": "weight",
  "weight kg": "weight",
  // Gender
  gender: "gender",
  sex: "gender",
  "m/f": "gender",
  // Age
  age: "ageCategory",
  "age category": "ageCategory",
  category: "ageCategory",
  division: "ageCategory",
  "age group": "ageCategory",
};

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (COLUMN_ALIASES[lower]) {
      mapping[COLUMN_ALIASES[lower]] = h;
    }
  }
  return mapping;
}

// ─── Excel generation (template) ─────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Name",
    "Club/Dojo",
    "Belt Rank",
    "Weight (kg)",
    "Gender",
    "Age Category",
  ];
  const samples = [
    ["Yuki Tanaka", "Tokyo Karate Club", "1st Dan", 65, "M", "Senior"],
    ["Kenji Watanabe", "Osaka Dojo", "3rd Kyu", 80, "M", "Junior"],
    ["Aiko Suzuki", "Kyoto Academy", "2nd Dan", 52, "F", "Senior"],
    ["Hana Kim", "Seoul Tigers", "1st Kyu", 47, "F", "Junior"],
    ["Marco Rossi", "Milano Dojo", "Shodan", 90, "M", "Senior"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
  // Column widths
  ws["!cols"] = [
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Competitors");
  XLSX.writeFile(wb, "karate-competitors-template.xlsx");
}

// ─── Parse Excel file ─────────────────────────────────────────────────────────

interface ParseResult {
  competitors: RawCompetitor[];
  errors: string[];
  unmappedColumns: string[];
}

function parseWorkbook(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        if (rows.length === 0) {
          resolve({
            competitors: [],
            errors: ["The spreadsheet is empty."],
            unmappedColumns: [],
          });
          return;
        }

        const rawHeaders = Object.keys(rows[0]);
        const mapping = mapHeaders(rawHeaders);
        const unmapped = rawHeaders.filter(
          (h) => !COLUMN_ALIASES[h.toLowerCase().trim()],
        );

        if (!mapping.name) {
          resolve({
            competitors: [],
            errors: [
              'Required column "Name" not found. Please check column headers.',
            ],
            unmappedColumns: unmapped,
          });
          return;
        }

        const competitors: RawCompetitor[] = [];
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2; // 1-indexed, skip header

          const name = String(
            (mapping.name ? row[mapping.name] : "") || "",
          ).trim();
          if (!name) {
            errors.push(`Row ${rowNum}: Empty name — skipped.`);
            continue;
          }

          const weightRaw = mapping.weight ? row[mapping.weight] : "";
          const weight = Number.parseFloat(
            String(weightRaw).replace(/[^\d.]/g, ""),
          );

          if (Number.isNaN(weight) || weight <= 0) {
            errors.push(
              `Row ${rowNum}: "${name}" has invalid weight "${weightRaw}" — defaulting to 75kg.`,
            );
          }

          competitors.push({
            name,
            dojo: String((mapping.dojo ? row[mapping.dojo] : "") || "").trim(),
            beltRank: String(
              (mapping.beltRank ? row[mapping.beltRank] : "") || "Unranked",
            ).trim(),
            weight: Number.isNaN(weight) || weight <= 0 ? 75 : weight,
            gender: String(
              (mapping.gender ? row[mapping.gender] : "") || "",
            ).trim(),
            ageCategory: String(
              (mapping.ageCategory ? row[mapping.ageCategory] : "") || "",
            ).trim(),
          });
        }

        resolve({ competitors, errors, unmappedColumns: unmapped });
      } catch (err) {
        reject(
          new Error(
            `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Group into weight categories ────────────────────────────────────────────

function groupByWeight(competitors: RawCompetitor[]): WeightGroup[] {
  const groups = new Map<string, WeightGroup>();
  for (const c of competitors) {
    const { divisionName, weightLabel } = categorizeCompetitor(c);
    if (!groups.has(divisionName)) {
      groups.set(divisionName, {
        divisionName,
        weightLabel,
        gender: detectGender(c.gender),
        competitors: [],
      });
    }
    groups.get(divisionName)!.competitors.push(c);
  }
  // Sort groups: males first by weight, then females, then open
  const order = ["male", "female", "open"];
  return Array.from(groups.values()).sort((a, b) => {
    const ao = order.indexOf(a.gender);
    const bo = order.indexOf(b.gender);
    if (ao !== bo) return ao - bo;
    return a.weightLabel.localeCompare(b.weightLabel);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExcelImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (firstDivisionId: bigint) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExcelImporter({
  open,
  onOpenChange,
  onImportComplete,
}: ExcelImporterProps) {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [groups, setGroups] = useState<WeightGroup[]>([]);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    status: "",
  });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<{
    competitorIndex: number;
    fromGroup: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setIsDragging(false);
    setParseErrors([]);
    setGroups([]);
    setProgress({ current: 0, total: 0, status: "" });
    setImportErrors([]);
    setEditingGroup(null);
    setReassignTarget(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const processFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".xlsx") &&
      !name.endsWith(".xls") &&
      !name.endsWith(".csv")
    ) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }

    try {
      const result = await parseWorkbook(file);
      if (result.competitors.length === 0) {
        setParseErrors(
          result.errors.length
            ? result.errors
            : ["No valid competitors found."],
        );
        return;
      }

      const grouped = groupByWeight(result.competitors);
      setGroups(grouped);
      setParseErrors(result.errors);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleImport = useCallback(async () => {
    if (!actor) {
      toast.error("Backend not ready");
      return;
    }

    const totalCompetitors = groups.reduce(
      (s, g) => s + g.competitors.length,
      0,
    );
    const totalSteps = groups.length + totalCompetitors + groups.length;
    let current = 0;
    const errors: string[] = [];
    const divisionIds: bigint[] = [];

    setStep("importing");
    setProgress({
      current: 0,
      total: totalSteps,
      status: "Creating divisions…",
    });

    for (const group of groups) {
      try {
        const divId = await actor.createDivision(
          group.divisionName,
          group.weightLabel,
        );
        divisionIds.push(divId);
        current++;
        setProgress({
          current,
          total: totalSteps,
          status: `Created division: ${group.divisionName}`,
        });
      } catch (err) {
        errors.push(
          `Failed to create division "${group.divisionName}": ${err instanceof Error ? err.message : String(err)}`,
        );
        divisionIds.push(BigInt(0));
        current++;
      }
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const divId = divisionIds[gi];
      if (divId === BigInt(0)) {
        current += group.competitors.length;
        setProgress({
          current,
          total: totalSteps,
          status: `Skipped competitors for "${group.divisionName}" (division creation failed)`,
        });
        continue;
      }

      for (const comp of group.competitors) {
        try {
          await actor.addCompetitor(
            comp.name,
            comp.dojo || "Independent",
            comp.beltRank || "Unranked",
            group.weightLabel,
            divId,
          );
          current++;
          setProgress({
            current,
            total: totalSteps,
            status: `Added: ${comp.name}`,
          });
        } catch (err) {
          errors.push(
            `Failed to add "${comp.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
          current++;
        }
      }
    }

    setProgress({
      current,
      total: totalSteps,
      status: "Generating brackets…",
    });

    for (let gi = 0; gi < groups.length; gi++) {
      const divId = divisionIds[gi];
      if (divId === BigInt(0)) {
        current++;
        continue;
      }
      try {
        await actor.generateBracket(divId);
        current++;
        setProgress({
          current,
          total: totalSteps,
          status: `Bracket generated: ${groups[gi].divisionName}`,
        });
      } catch (err) {
        errors.push(
          `Failed to generate bracket for "${groups[gi].divisionName}": ${err instanceof Error ? err.message : String(err)}`,
        );
        current++;
      }
    }

    setImportErrors(errors);
    setProgress({
      current: totalSteps,
      total: totalSteps,
      status: "Import complete!",
    });
    setStep("done");

    // Invalidate and refresh
    await queryClient.invalidateQueries({ queryKey: ["divisions"] });

    const firstValidId = divisionIds.find((id) => id !== BigInt(0));
    if (firstValidId !== undefined) {
      onImportComplete(firstValidId);
    }

    if (errors.length === 0) {
      toast.success(
        `Imported ${totalCompetitors} competitors across ${groups.length} divisions!`,
      );
    } else {
      toast.warning(`Import completed with ${errors.length} warning(s)`);
    }
  }, [actor, groups, queryClient, onImportComplete]);

  // Reassign competitor to a different group
  const handleReassign = useCallback(
    (competitorIndex: number, fromGroup: string, toGroupName: string) => {
      setGroups((prev) => {
        const updated = prev.map((g) => ({
          ...g,
          competitors: [...g.competitors],
        }));
        const fromIdx = updated.findIndex((g) => g.divisionName === fromGroup);
        const toIdx = updated.findIndex((g) => g.divisionName === toGroupName);
        if (fromIdx === -1 || toIdx === -1) return prev;

        const [comp] = updated[fromIdx].competitors.splice(competitorIndex, 1);
        updated[toIdx].competitors.push(comp);

        // Remove empty groups
        return updated.filter((g) => g.competitors.length > 0);
      });
      setReassignTarget(null);
    },
    [],
  );

  const progressPct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-popover border-border text-foreground max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg">
                Import from Excel
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Upload competitor data and auto-generate weight-category
                brackets
              </DialogDescription>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(["upload", "preview", "importing", "done"] as Step[]).map(
              (s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium transition-colors",
                      step === s
                        ? "text-primary"
                        : i <
                            ["upload", "preview", "importing", "done"].indexOf(
                              step,
                            )
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors",
                        step === s
                          ? "bg-primary/20 border-primary text-primary"
                          : i <
                              [
                                "upload",
                                "preview",
                                "importing",
                                "done",
                              ].indexOf(step)
                            ? "bg-muted border-border text-muted-foreground"
                            : "border-border/40 text-muted-foreground/40",
                      )}
                    >
                      {i + 1}
                    </div>
                    <span className="capitalize hidden sm:block">{s}</span>
                  </div>
                  {i < 3 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                  )}
                </div>
              ),
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <UploadStep
                key="upload"
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                onProcessFile={processFile}
                onFileChange={handleFileChange}
                fileInputRef={fileInputRef}
                parseErrors={parseErrors}
              />
            )}
            {step === "preview" && (
              <PreviewStep
                key="preview"
                groups={groups}
                parseErrors={parseErrors}
                editingGroup={editingGroup}
                setEditingGroup={setEditingGroup}
                reassignTarget={reassignTarget}
                setReassignTarget={setReassignTarget}
                onReassign={handleReassign}
                onBack={() => {
                  setStep("upload");
                  setGroups([]);
                  setParseErrors([]);
                }}
                onImport={handleImport}
              />
            )}
            {step === "importing" && (
              <ImportingStep
                key="importing"
                progress={progress}
                progressPct={progressPct}
              />
            )}
            {step === "done" && (
              <DoneStep
                key="done"
                groups={groups}
                importErrors={importErrors}
                onClose={handleClose}
              />
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-steps ────────────────────────────────────────────────────────────────

function UploadStep({
  isDragging,
  setIsDragging,
  onProcessFile,
  onFileChange,
  fileInputRef,
  parseErrors,
}: {
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onProcessFile: (file: File) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  parseErrors: string[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full flex flex-col gap-4 p-6 overflow-y-auto"
    >
      {/* Download template */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Download Template
            </p>
            <p className="text-xs text-muted-foreground">
              Pre-formatted Excel with sample competitors
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="gap-2 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent hover:border-accent/60"
        >
          <Download className="h-3.5 w-3.5" />
          Template
        </Button>
      </div>

      {/* Column reference */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { col: "Name*", aliases: "name, athlete" },
          { col: "Club/Dojo", aliases: "club, team, organization" },
          { col: "Belt Rank", aliases: "belt, grade, kyu, dan" },
          { col: "Weight (kg)*", aliases: "weight, kg, body weight" },
          { col: "Gender", aliases: "gender, sex, m/f" },
          { col: "Age Category", aliases: "age, category, division" },
        ].map(({ col, aliases }) => (
          <div
            key={col}
            className="flex items-start gap-2 p-2 rounded-md bg-card/50 border border-border/50"
          >
            <span className="font-mono text-primary/80 font-semibold whitespace-nowrap">
              {col}
            </span>
            <span className="text-muted-foreground">{aliases}</span>
          </div>
        ))}
      </div>

      {/* Drop zone — use <label> so it natively activates the hidden file input */}
      <label
        htmlFor="excel-file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onProcessFile(file);
        }}
        className={cn(
          "relative flex-1 min-h-40 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none focus-within:ring-2 focus-within:ring-primary",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/20",
        )}
      >
        <motion.div
          animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
          className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center"
        >
          <Upload className="h-6 w-6 text-primary" />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {isDragging ? "Drop to upload" : "Drag & drop or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports .xlsx, .xls, .csv
          </p>
        </div>
        <input
          id="excel-file-input"
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileChange}
          className="sr-only"
        />
      </label>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="space-y-1.5">
          {parseErrors.map((err) => (
            <div
              key={err}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30"
            >
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{err}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PreviewStep({
  groups,
  parseErrors,
  editingGroup,
  setEditingGroup,
  reassignTarget,
  setReassignTarget,
  onReassign,
  onBack,
  onImport,
}: {
  groups: WeightGroup[];
  parseErrors: string[];
  editingGroup: string | null;
  setEditingGroup: (v: string | null) => void;
  reassignTarget: { competitorIndex: number; fromGroup: string } | null;
  setReassignTarget: (
    v: { competitorIndex: number; fromGroup: string } | null,
  ) => void;
  onReassign: (idx: number, from: string, to: string) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const totalCompetitors = groups.reduce((s, g) => s + g.competitors.length, 0);
  const otherGroupNames = reassignTarget
    ? groups
        .map((g) => g.divisionName)
        .filter((n) => n !== reassignTarget.fromGroup)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full flex flex-col"
    >
      {/* Summary bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {totalCompetitors}
            </span>
            <span className="text-muted-foreground">competitors</span>
          </div>
          <div className="text-muted-foreground/40">•</div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {groups.length}
            </span>
            <span className="text-muted-foreground">weight categories</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          Click a competitor to reassign
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {groups.map((group) => (
            <motion.div
              key={group.divisionName}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setEditingGroup(
                    editingGroup === group.divisionName
                      ? null
                      : group.divisionName,
                  )
                }
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-card/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold",
                      group.gender === "male"
                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        : group.gender === "female"
                          ? "bg-pink-500/15 text-pink-400 border border-pink-500/30"
                          : "bg-accent/15 text-accent border border-accent/30",
                    )}
                  >
                    {group.gender === "male"
                      ? "♂"
                      : group.gender === "female"
                        ? "♀"
                        : "○"}{" "}
                    {group.divisionName}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {group.competitors.length} competitor
                    {group.competitors.length !== 1 ? "s" : ""}
                  </span>
                  <motion.div
                    animate={{
                      rotate: editingGroup === group.divisionName ? 90 : 0,
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {editingGroup === group.divisionName && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-2 border-t border-border/50 bg-background/30">
                      <div className="grid grid-cols-1 gap-1">
                        {group.competitors.map((c, idx) => (
                          <div
                            key={`${c.name}-${c.dojo}-${idx}`}
                            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                                {c.name[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {c.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {c.dojo || "—"} · {c.beltRank} · {c.weight}kg
                                </p>
                              </div>
                            </div>
                            {/* Reassign */}
                            {reassignTarget?.competitorIndex === idx &&
                            reassignTarget.fromGroup === group.divisionName ? (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Select
                                  onValueChange={(val) =>
                                    onReassign(idx, group.divisionName, val)
                                  }
                                >
                                  <SelectTrigger className="h-7 w-40 text-xs bg-input border-border">
                                    <SelectValue placeholder="Move to…" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border">
                                    {otherGroupNames.map((n) => (
                                      <SelectItem
                                        key={n}
                                        value={n}
                                        className="text-xs"
                                      >
                                        {n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setReassignTarget(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                                onClick={() =>
                                  setReassignTarget({
                                    competitorIndex: idx,
                                    fromGroup: group.divisionName,
                                  })
                                }
                              >
                                Move
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {/* Parse warnings */}
          {parseErrors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Warnings ({parseErrors.length})
              </p>
              {parseErrors.map((err) => (
                <div
                  key={err}
                  className="flex items-start gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-accent/80">{err}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0 bg-popover">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Button>
        <Button
          onClick={onImport}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Generate {groups.length} Bout Chart{groups.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </motion.div>
  );
}

function ImportingStep({
  progress,
  progressPct,
}: {
  progress: ImportProgress;
  progressPct: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center justify-center gap-6 p-10 h-full"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
      <div className="w-full max-w-sm space-y-3 text-center">
        <p className="text-base font-semibold text-foreground">
          Importing competitors…
        </p>
        <Progress value={progressPct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress.status}</span>
          <span>{progressPct}%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {progress.current} / {progress.total} steps complete
        </p>
      </div>
    </motion.div>
  );
}

function DoneStep({
  groups,
  importErrors,
  onClose,
}: {
  groups: WeightGroup[];
  importErrors: string[];
  onClose: () => void;
}) {
  const totalCompetitors = groups.reduce((s, g) => s + g.competitors.length, 0);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex flex-col items-center justify-center gap-6 p-10 h-full"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center",
          importErrors.length === 0
            ? "bg-green-500/15 border border-green-500/30"
            : "bg-accent/15 border border-accent/30",
        )}
      >
        <CheckCircle2
          className={cn(
            "h-8 w-8",
            importErrors.length === 0 ? "text-green-400" : "text-accent",
          )}
        />
      </motion.div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-display font-bold text-foreground">
          Import Complete!
        </h3>
        <p className="text-sm text-muted-foreground">
          Successfully imported{" "}
          <span className="text-foreground font-semibold">
            {totalCompetitors}
          </span>{" "}
          competitors across{" "}
          <span className="text-foreground font-semibold">{groups.length}</span>{" "}
          weight categories
        </p>
      </div>

      {importErrors.length > 0 && (
        <ScrollArea className="w-full max-h-32 rounded-lg border border-accent/30 bg-accent/5">
          <div className="p-3 space-y-1.5">
            {importErrors.map((err) => (
              <div key={err} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-accent/80">{err}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Button
        onClick={onClose}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        View Bout Charts
      </Button>
    </motion.div>
  );
}
