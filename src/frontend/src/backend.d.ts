import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Competitor {
    id: bigint;
    dojo: string;
    name: string;
    weightClass: string;
    beltRank: string;
    divisionId: bigint;
}
export interface Division {
    id: bigint;
    name: string;
    weightClass: string;
}
export interface Bout {
    id: bigint;
    winnerId?: bigint;
    competitor1Id: bigint;
    competitor2Id?: bigint;
    divisionId: bigint;
    boutNumber: bigint;
    round: bigint;
}
export interface backendInterface {
    addCompetitor(name: string, dojo: string, beltRank: string, weightClass: string, divisionId: bigint): Promise<bigint>;
    createDivision(name: string, weightClass: string): Promise<bigint>;
    deleteDivision(id: bigint): Promise<boolean>;
    generateBracket(divisionId: bigint): Promise<boolean>;
    getDivisionWithBouts(divisionId: bigint): Promise<{
        division: Division;
        competitors: Array<Competitor>;
        bouts: Array<Bout>;
    } | null>;
    listCompetitorsByDivision(divisionId: bigint): Promise<Array<Competitor>>;
    listDivisions(): Promise<Array<Division>>;
    recordResult(boutId: bigint, winnerId: bigint): Promise<boolean>;
    removeCompetitor(id: bigint): Promise<boolean>;
    resetBracket(divisionId: bigint): Promise<boolean>;
    /**
     * / From the old backend that will not even compile with the new Map library:
     */
    seedSampleData(): Promise<void>;
}
