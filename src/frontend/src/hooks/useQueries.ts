import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bout, Competitor, Division } from "../backend.d.ts";
import { useActor } from "./useActor";

export type { Competitor, Division, Bout };

export interface DivisionWithBouts {
  division: Division;
  competitors: Array<Competitor>;
  bouts: Array<Bout>;
}

// ─── Queries ──────────────────────────────────────────────

export function useListDivisions() {
  const { actor, isFetching } = useActor();
  return useQuery<Division[]>({
    queryKey: ["divisions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listDivisions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetDivisionWithBouts(divisionId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<DivisionWithBouts | null>({
    queryKey: ["division-bouts", divisionId?.toString()],
    queryFn: async () => {
      if (!actor || divisionId === null) return null;
      const result = await actor.getDivisionWithBouts(divisionId);
      return result ?? null;
    },
    enabled: !!actor && !isFetching && divisionId !== null,
  });
}

// ─── Mutations ────────────────────────────────────────────

export function useCreateDivision() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      weightClass,
    }: {
      name: string;
      weightClass: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createDivision(name, weightClass);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
    },
  });
}

export function useDeleteDivision() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteDivision(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
    },
  });
}

export function useAddCompetitor() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      dojo,
      beltRank,
      weightClass,
      divisionId,
    }: {
      name: string;
      dojo: string;
      beltRank: string;
      weightClass: string;
      divisionId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addCompetitor(name, dojo, beltRank, weightClass, divisionId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["division-bouts", variables.divisionId.toString()],
      });
    },
  });
}

export function useRemoveCompetitor() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: bigint;
      divisionId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.removeCompetitor(id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["division-bouts", variables.divisionId.toString()],
      });
    },
  });
}

export function useGenerateBracket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (divisionId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.generateBracket(divisionId);
    },
    onSuccess: (_data, divisionId) => {
      queryClient.invalidateQueries({
        queryKey: ["division-bouts", divisionId.toString()],
      });
    },
  });
}

export function useResetBracket() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (divisionId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.resetBracket(divisionId);
    },
    onSuccess: (_data, divisionId) => {
      queryClient.invalidateQueries({
        queryKey: ["division-bouts", divisionId.toString()],
      });
    },
  });
}

export function useRecordResult() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      boutId,
      winnerId,
    }: {
      boutId: bigint;
      winnerId: bigint;
      divisionId: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.recordResult(boutId, winnerId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["division-bouts", variables.divisionId.toString()],
      });
    },
  });
}

export function useSeedSampleData() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.seedSampleData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
    },
  });
}
