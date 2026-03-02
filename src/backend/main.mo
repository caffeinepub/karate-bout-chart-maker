import Array "mo:core/Array";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";

actor {
  type Competitor = {
    id : Nat;
    name : Text;
    dojo : Text;
    beltRank : Text;
    weightClass : Text;
    divisionId : Nat;
  };

  type Bout = {
    id : Nat;
    divisionId : Nat;
    round : Nat;
    boutNumber : Nat;
    competitor1Id : Nat;
    competitor2Id : ?Nat;
    winnerId : ?Nat;
  };

  type Division = {
    id : Nat;
    name : Text;
    weightClass : Text;
  };

  var nextDivisionId = 1;
  var nextCompetitorId = 1;
  var nextBoutId = 1;

  let divisions = Map.empty<Nat, Division>();
  let competitors = Map.empty<Nat, Competitor>();
  let bouts = Map.empty<Nat, Bout>();

  public shared ({ caller }) func createDivision(name : Text, weightClass : Text) : async Nat {
    let id = nextDivisionId;
    let division : Division = {
      id;
      name;
      weightClass;
    };
    divisions.add(id, division);
    nextDivisionId += 1;
    id;
  };

  public shared ({ caller }) func deleteDivision(id : Nat) : async Bool {
    switch (divisions.get(id)) {
      case (null) { false };
      case (?_) {
        divisions.remove(id);
        true;
      };
    };
  };

  public query ({ caller }) func listDivisions() : async [Division] {
    divisions.values().toArray();
  };

  public shared ({ caller }) func addCompetitor(name : Text, dojo : Text, beltRank : Text, weightClass : Text, divisionId : Nat) : async Nat {
    let id = nextCompetitorId;
    let competitor : Competitor = {
      id;
      name;
      dojo;
      beltRank;
      weightClass;
      divisionId;
    };
    competitors.add(id, competitor);
    nextCompetitorId += 1;
    id;
  };

  public shared ({ caller }) func removeCompetitor(id : Nat) : async Bool {
    switch (competitors.get(id)) {
      case (null) { false };
      case (?_) {
        competitors.remove(id);
        true;
      };
    };
  };

  public query ({ caller }) func listCompetitorsByDivision(divisionId : Nat) : async [Competitor] {
    competitors.values().toArray().filter(func(c) { c.divisionId == divisionId });
  };

  public shared ({ caller }) func generateBracket(divisionId : Nat) : async Bool {
    // Get competitors for the division
    let divisionCompetitors = competitors.values().toArray().filter(func(c) { c.divisionId == divisionId });
    let numCompetitors = divisionCompetitors.size();

    if (numCompetitors < 2) {
      return false;
    };

    // Clear existing bouts for division
    let divisionBouts = bouts.entries().toArray().filter(func((_, b)) { b.divisionId == divisionId });
    for (boutId in divisionBouts.map(func((id, _)) { id }).values()) {
      bouts.remove(boutId);
    };

    // Calculate number of rounds (next power of 2)
    var numRounds = 1;
    var matchesInRound = 2;
    while (matchesInRound < numCompetitors) {
      numRounds += 1;
      matchesInRound *= 2;
    };

    // Create first round matches
    var boutNumber = 1;
    var i = 0;
    while (i < numCompetitors) {
      let competitor1 = divisionCompetitors[i].id;
      var competitor2 : ?Nat = null;
      if (i + 1 < numCompetitors) {
        competitor2 := ?divisionCompetitors[i + 1].id;
      };

      let bout : Bout = {
        id = nextBoutId;
        divisionId;
        round = 1;
        boutNumber;
        competitor1Id = competitor1;
        competitor2Id = competitor2;
        winnerId = null;
      };
      bouts.add(nextBoutId, bout);
      nextBoutId += 1;
      boutNumber += 1;
      i += 2;
    };

    // Later rounds will be dynamically created as winners are recorded
    true;
  };

  public shared ({ caller }) func recordResult(boutId : Nat, winnerId : Nat) : async Bool {
    let bout = switch (bouts.get(boutId)) {
      case (null) { Runtime.trap("Bout not found") };
      case (?bout) { bout };
    };

    if (bout.competitor1Id != winnerId and bout.competitor2Id != ?winnerId) {
      return false;
    };

    let updatedBout : Bout = {
      id = bout.id;
      divisionId = bout.divisionId;
      round = bout.round;
      boutNumber = bout.boutNumber;
      competitor1Id = bout.competitor1Id;
      competitor2Id = bout.competitor2Id;
      winnerId = ?winnerId;
    };
    bouts.add(boutId, updatedBout);

    // Create next round bout if necessary
    let nextRound = bout.round + 1;
    let nextBoutNumber = (bout.boutNumber + 1) / 2;

    // Check if both winners for the next round are determined
    let siblingBoutNumber = if (bout.boutNumber % 2 == 1) { bout.boutNumber + 1 } else {
      bout.boutNumber - 1;
    };

    let siblingBout = bouts.values().toArray().find(
      func(b) { b.divisionId == bout.divisionId and b.round == bout.round and b.boutNumber == siblingBoutNumber }
    );

    if (siblingBoutNumber != 0 and siblingBoutNumber != bout.boutNumber) {
      let nextRoundBout = bouts.values().toArray().find(
        func(b) {
          b.divisionId == bout.divisionId and b.round == nextRound and b.boutNumber == nextBoutNumber
        }
      );

      switch (nextRoundBout, siblingBout) {
        case (null, ?_sibling) {
          var competitors : (?Nat, ?Nat) = (null, null);

          if (bout.boutNumber % 2 == 1) {
            competitors := (?winnerId, null);
          } else {
            competitors := (null, ?winnerId);
          };

          let siblingWinnerId = switch (siblingBout) {
            case (null) { null };
            case (?sibling) { sibling.winnerId };
          };

          if (bout.boutNumber % 2 == 1) {
            competitors := (competitors.0, siblingWinnerId);
          } else {
            competitors := (siblingWinnerId, competitors.1);
          };

          if (competitors.0 != null or competitors.1 != null) {
            let newBout : Bout = {
              id = nextBoutId;
              divisionId = bout.divisionId;
              round = nextRound;
              boutNumber = nextBoutNumber;
              competitor1Id = switch (competitors.0) {
                case (null) { Runtime.trap("Competitor1Id is null") };
                case (?id) { id };
              };
              competitor2Id = competitors.1;
              winnerId = null;
            };
            bouts.add(nextBoutId, newBout);
            nextBoutId += 1;
          };
        };
        case (_) {};
      };
    };

    true;
  };

  public shared ({ caller }) func resetBracket(divisionId : Nat) : async Bool {
    let divisionBouts = bouts.entries().toArray().filter(func((_, b)) { b.divisionId == divisionId });
    for (boutId in divisionBouts.map(func((id, _)) { id }).values()) {
      bouts.remove(boutId);
    };
    true;
  };

  public query ({ caller }) func getDivisionWithBouts(divisionId : Nat) : async ?{
    division : Division;
    competitors : [Competitor];
    bouts : [Bout];
  } {
    switch (divisions.get(divisionId)) {
      case (null) { null };
      case (?division) {
        let divisionCompetitors = competitors.values().toArray().filter(func(c) { c.divisionId == divisionId });
        let divisionBouts = bouts.values().toArray().filter(func(b) { b.divisionId == divisionId });
        ?{
          division;
          competitors = divisionCompetitors;
          bouts = divisionBouts;
        };
      };
    };
  };

  /// From the old backend that will not even compile with the new Map library:
  public shared ({ caller }) func seedSampleData() : async () {
    let divisionId1 : Nat = nextDivisionId;
    let division1 : Division = {
      id = divisionId1;
      name = "Lightweight Boys";
      weightClass = "U14";
    };
    divisions.add(divisionId1, division1);
    nextDivisionId += 1;

    let divisionId2 : Nat = nextDivisionId;
    let division2 : Division = {
      id = divisionId2;
      name = "Beginner Girls";
      weightClass = "U10";
    };
    divisions.add(divisionId2, division2);
    nextDivisionId += 1;

    let divisionId3 : Nat = nextDivisionId;
    let division3 : Division = {
      id = divisionId3;
      name = "Teen Advanced";
      weightClass = "U16";
    };
    divisions.add(divisionId3, division3);
    nextDivisionId += 1;

    let competitorsData = [
      // Division 1
      ("Billy Smith", "Kaizen Dojo", "Yellow", "Lightweight", divisionId1),
      ("Carlos Reyes", "Victory Karate", "Orange", "Lightweight", divisionId1),
      ("Trevor Williams", "Fighting Spirit", "Green", "Lightweight", divisionId1),
      ("Ali Johnson", "Kaizen Dojo", "Yellow", "Lightweight", divisionId1),
      // Division 2
      ("Lisa Torres", "Kaizen Dojo", "White", "Beginner", divisionId2),
      ("Emma Singh", "Kaizen Dojo", "Yellow", "Beginner", divisionId2),
      ("Natalie Lee", "Victory Karate", "Yellow", "Beginner", divisionId2),
      // Division 3
      ("Marcus Belton", "Fighting Spirit", "Blue", "Advanced", divisionId3),
      ("Kayla Johnson", "Kaizen Dojo", "Red", "Advanced", divisionId3),
      ("Adam Hunter", "Victory Karate", "Brown", "Advanced", divisionId3),
    ];

    for (entry in competitorsData.values()) {
      let id = nextCompetitorId;
      let competitor : Competitor = {
        id;
        name = entry.0;
        dojo = entry.1;
        beltRank = entry.2;
        weightClass = entry.3;
        divisionId = entry.4;
      };
      competitors.add(id, competitor);
      nextCompetitorId += 1;
    };
  };
};
