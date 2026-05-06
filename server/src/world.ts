export interface RoomCode {
  town: string;
  square: string;
  zone: string;
}

export interface RoomExit {
  direction: string;
  destination: RoomId;
  details: string;
}

export interface RoomShopItem {
  code: string;
  name: string;
  price: number;
  currency: "plat" | "trias" | "lucan" | "silk";
}

export interface RoomShop {
  code: string;
  name: string;
  items: RoomShopItem[];
}

export interface RoomForageItem {
  code: string;
  name: string;
}

export interface RoomForage {
  difficulty: number;
  items: RoomForageItem[];
}

export interface Room {
  id: RoomId;
  code: RoomCode;
  title: string;
  description: string;
  prompts: string[];
  exits: RoomExit[];
  guild?: string;
  shop?: RoomShop;
  forage?: RoomForage;
}

export interface Guild {
  id: string;
  name: string;
  roomId: RoomId;
}

export type RoomId = string;

export type MovementDecision =
  | { moved: true; direction: string; nextRoom: Room; events: string[] }
  | { moved: false; reason: 'broken_exit' | 'unknown_command'; direction: string; events: string[] };

export const worldRooms: Record<RoomId, Room> = {
  "crossing-TG01-001": {
    id: "crossing-TG01-001",
    code: { town: "crossing", square: "TG01", zone: "crossing-town" },
    title: "Crossing Town Green",
    description:
      "A broad square with the fountain, a few benches, and merchants crossing through the center.",
    prompts: [
      "You see a small crowd near the center of town.",
      "A guard nods toward the market road.",
    ],
    exits: [
      { direction: "north", destination: "crossing-IN02-001", details: "Toward the inns and guesthouses." },
      { direction: "east", destination: "crossing-MA01-001", details: "Toward the training lanes and practice targets." },
      { direction: "south", destination: "crossing-RV01-001", details: "Toward the gate road and outskirts." },
      { direction: "northeast", destination: "crossing-GU01-001", details: "Toward the martial practice hall." },
      { direction: "northwest", destination: "crossing-GU02-001", details: "Toward the arcane study hall." },
      { direction: "southeast", destination: "crossing-GU03-001", details: "Toward the trail scout lodge." },
      { direction: "southwest", destination: "crossing-GU04-001", details: "Toward the shadowed utility hall." },
      { direction: "up", destination: "crossing-GU05-001", details: "Toward the Cleric Guild hall." },
    ],
  },
  "crossing-IN02-001": {
    id: "crossing-IN02-001",
    code: { town: "crossing", square: "IN02", zone: "crossing-town" },
    title: "Crossing Inns Row",
    description:
      "A line of inns with warm light spilling from open windows. People trade stories and cups of ale.",
    prompts: ["The inn doors stay open and welcoming."],
    exits: [
      { direction: "south", destination: "crossing-TG01-001", details: "Back to the town green." },
      { direction: "north", destination: "crossing-GU06-001", details: "Toward the Bard Guild conservatory." },
      { direction: "east", destination: "crossing-GU07-001", details: "Toward the Trader Guild exchange." },
      { direction: "west", destination: "crossing-GU08-001", details: "Toward the Empath Guild clinic." },
      { direction: "enter", destination: "crossing-TB01-001", details: "Enter Taelbert’s inn." },
    ],
  },
  "crossing-MA01-001": {
    id: "crossing-MA01-001",
    code: { town: "crossing", square: "MA01", zone: "crossing-town" },
    title: "Marksman Way",
    description:
      "A narrow alley with targets and old training rigs, where movement and aim are in constant motion.",
    prompts: ["You hear arrows singing past your shoulders."],
    exits: [
      { direction: "west", destination: "crossing-TG01-001", details: "Return to the town green." },
      { direction: "east", destination: "crossing-GU09-001", details: "Toward the Paladin Guild yard." },
      {
        direction: "north",
        destination: "crossing-MA01-002",
        details: "A gate that leads to practice sheds.",
      },
    ],
  },
  "crossing-RV01-001": {
    id: "crossing-RV01-001",
    code: { town: "crossing", square: "RV01", zone: "crossing-outskirts" },
    title: "South Gate Road",
    description:
      "The road drops toward the gate approach. This is a common route for first foraging runs.",
    prompts: ["A small caravan rattles toward the marsh boundary."],
    exits: [
      { direction: "north", destination: "crossing-TG01-001", details: "Return to town." },
      { direction: "east", destination: "crossing-GU10-001", details: "Toward the Barbarian Guild pit." },
      { direction: "west", destination: "crossing-GU11-001", details: "Toward the Warrior Mage Guild range." },
      { direction: "south", destination: "crossing-RV02-001", details: "Continue toward the gate trail." },
    ],
    forage: {
      difficulty: 1,
      items: [{ code: "foraged-fieldherb", name: "field herb bundle" }],
    },
  },
  "crossing-RV02-001": {
    id: "crossing-RV02-001",
    code: { town: "crossing", square: "RV02", zone: "crossing-outskirts" },
    title: "South Gate Trailhead",
    description:
      "The gate marker sits back by the road. Foragers pass in and out with small bundles.",
    prompts: ["You can smell damp reeds carried from low marshland."],
    exits: [
      { direction: "north", destination: "crossing-RV01-001", details: "Return to the gate road." },
      { direction: "east", destination: "crossing-RV02-002", details: "A foraging path." },
    ],
    forage: {
      difficulty: 1,
      items: [{ code: "foraged-fieldherb", name: "field herb bundle" }],
    },
  },
  "crossing-RV02-002": {
    id: "crossing-RV02-002",
    code: { town: "crossing", square: "RV02", zone: "crossing-outskirts" },
    title: "Brushline Forage Fork",
    description:
      "Scrubland edges and low brush. Safe for now, but ideal for low-level encounter rolls.",
    prompts: ["You spot movement in the brush, but nothing approaches yet."],
    exits: [
      { direction: "west", destination: "crossing-RV02-001", details: "Return toward the trailhead." },
      { direction: "south", destination: "crossing-RV02-003", details: "A narrow game path." },
      { direction: "east", destination: "crossing-RV02-004", details: "A muddy bend near beetle stones." },
    ],
    forage: {
      difficulty: 1,
      items: [{ code: "foraged-fieldherb", name: "field herb bundle" }],
    },
  },
  "crossing-RV02-003": {
    id: "crossing-RV02-003",
    code: { town: "crossing", square: "RV02", zone: "crossing-hunting" },
    title: "Willow Tract",
    description:
      "A narrow game trail leading outward. Beginner-safe critters can be tracked here.",
    prompts: ["A training dummy stands farther in the distance."],
    exits: [
      { direction: "north", destination: "crossing-RV02-002", details: "Backtrack the path." },
      { direction: "south", destination: "crossing-RV02-005", details: "Toward a quiet low ridge." },
    ],
    forage: {
      difficulty: 2,
      items: [{ code: "foraged-willowbark", name: "willow bark strip" }],
    },
    shop: {
      code: "crossing-outskirts-general",
      name: "Crossing Forage Supply Stand",
      items: [
        { code: "itm-branch-knife", name: "branch knife", price: 3, currency: "trias" },
        { code: "itm-rope-coil", name: "hemp rope (25')", price: 6, currency: "trias" },
      ],
    },
  },
  "crossing-RV02-004": {
    id: "crossing-RV02-004",
    code: { town: "crossing", square: "RV02", zone: "crossing-hunting" },
    title: "Muddy Beetle Bend",
    description:
      "Wet stones and root tangles mark a shallow bend where small shell-backed vermin pick through the mud.",
    prompts: ["A few cracked husks sit beside the trail."],
    exits: [
      { direction: "west", destination: "crossing-RV02-002", details: "Return to the brushline fork." },
    ],
    forage: {
      difficulty: 2,
      items: [{ code: "foraged-mudroot", name: "mudroot sprig" }],
    },
    shop: {
      code: "crossing-beetle-forager",
      name: "Muddy Bend Forager Cache",
      items: [
        { code: "itm-mud-salve", name: "mud salve", price: 4, currency: "trias" },
        { code: "itm-shell-scraper", name: "shell scraper", price: 5, currency: "trias" },
      ],
    },
  },
  "crossing-RV02-005": {
    id: "crossing-RV02-005",
    code: { town: "crossing", square: "RV02", zone: "crossing-hunting" },
    title: "Low Ridge Rabbit Run",
    description:
      "A low grassy ridge overlooks the outer brush. Small tracks cut between the stones and vanish under thorny cover.",
    prompts: ["Loose pebbles shift underfoot whenever the wind picks up."],
    exits: [
      { direction: "north", destination: "crossing-RV02-003", details: "Back toward the willow tract." },
    ],
    forage: {
      difficulty: 2,
      items: [{ code: "foraged-ridgegrass", name: "ridge grass bundle" }],
    },
    shop: {
      code: "crossing-ridge-snare-kit",
      name: "Ridge Snare Kit",
      items: [
        { code: "itm-twine-snare", name: "twine snare", price: 3, currency: "trias" },
        { code: "itm-field-ration", name: "field ration", price: 2, currency: "trias" },
      ],
    },
  },
  "crossing-MA01-002": {
    id: "crossing-MA01-002",
    code: { town: "crossing", square: "MA01", zone: "crossing-town" },
    title: "Marksman Sheds",
    description:
      "A shed courtyard with spare bows, target frames, and trainers giving short feedback.",
    prompts: ["A target resetter calls for next practice round."],
    exits: [{ direction: "south", destination: "crossing-MA01-001", details: "Back toward the way." }],
    shop: {
      code: "crossing-marksman-stand",
      name: "Marksman Supply Stand",
      items: [
        { code: "itm-practice-bow", name: "practice bow", price: 12, currency: "plat" },
        { code: "itm-sting-arrow", name: "practice arrow", price: 1, currency: "trias" },
      ],
    },
  },
  "crossing-TB01-001": {
    id: "crossing-TB01-001",
    code: { town: "crossing", square: "TB01", zone: "crossing-town" },
    title: "Taelbert’s Inn",
    description: "A warm hall with sturdy tables, practical food, and a quiet counter.",
    prompts: ["Taelbert nods once and gestures toward a room key bar."],
    exits: [{ direction: "exit", destination: "crossing-IN02-001", details: "Leave the inn." }],
  },
  "crossing-GU01-001": {
    id: "crossing-GU01-001",
    code: { town: "crossing", square: "GU01", zone: "crossing-town" },
    title: "Crossing Martial Practice Hall",
    description:
      "A long stone hall with sparring markers and heavy training dummies. Newcomers report here first for practical combat basics.",
    prompts: ["The guild steward points to a rack of practice weapons."],
    exits: [{ direction: "southwest", destination: "crossing-TG01-001", details: "Return to the town green." }],
    shop: {
      code: "crossing-martial-armory",
      name: "Martial Practice Armory",
      items: [
        { code: "itm-training-mace", name: "training mace", price: 8, currency: "plat" },
        { code: "itm-chain-gloves", name: "chain gloves", price: 7, currency: "plat" },
      ],
    },
  },
  "crossing-GU02-001": {
    id: "crossing-GU02-001",
    code: { town: "crossing", square: "GU02", zone: "crossing-town" },
    title: "Crossing Arcane Study Hall",
    description:
      "A quiet hall of sigils and chalk circles where apprentices discuss theory and control.",
    prompts: ["Runes in the dust glow faintly and fade again."],
    exits: [
      { direction: "southeast", destination: "crossing-TG01-001", details: "Return to the town green." },
      { direction: "north", destination: "crossing-GU12-001", details: "Toward the Moon Mage Guild observatory." },
      { direction: "down", destination: "crossing-GU13-001", details: "Toward a sealed lower study." },
    ],
    shop: {
      code: "crossing-arcane-study",
      name: "Arcane Study Supply",
      items: [
        { code: "itm-focusing-slate", name: "focusing slate", price: 16, currency: "plat" },
        { code: "itm-lingering-ink", name: "lingering ink", price: 4, currency: "trias" },
      ],
    },
  },
  "crossing-GU03-001": {
    id: "crossing-GU03-001",
    code: { town: "crossing", square: "GU03", zone: "crossing-town" },
    title: "Crossing Trail Scout Lodge",
    description:
      "A quiet building with maps, routes, and low walls for tactical exercises.",
    prompts: ["A cartographer traces routes between hunting waypoints."],
    exits: [
      { direction: "northwest", destination: "crossing-TG01-001", details: "Return to the town green." },
      { direction: "east", destination: "crossing-GU14-001", details: "Toward the Ranger Guild field room." },
    ],
    shop: {
      code: "crossing-scout-supply",
      name: "Trail Scout Route Stand",
      items: [
        { code: "itm-compass", name: "travel compass", price: 10, currency: "plat" },
        { code: "itm-climbing-clasps", name: "climbing clasps", price: 5, currency: "trias" },
      ],
    },
  },
  "crossing-GU04-001": {
    id: "crossing-GU04-001",
    code: { town: "crossing", square: "GU04", zone: "crossing-town" },
    title: "Crossing Shadowed Utility Hall",
    description:
      "Narrow lanes, padded walls, and soft-voiced instructors keep practice runs discreet and efficient.",
    prompts: ["A pair of hands move through lockwork and pressure catches silently."],
    exits: [
      { direction: "northeast", destination: "crossing-TG01-001", details: "Return to the town green." },
      { direction: "west", destination: "crossing-GU15-001", details: "Toward the Thief Guild practice room." },
    ],
    shop: {
      code: "crossing-rogue-gear",
      name: "Shadowed Utility Hall",
      items: [
        { code: "itm-lockpick-set", name: "lockpick set", price: 18, currency: "plat" },
        { code: "itm-dark-hood", name: "dark hood", price: 7, currency: "trias" },
      ],
    },
  },
  "crossing-GU05-001": {
    id: "crossing-GU05-001",
    code: { town: "crossing", square: "GU05", zone: "crossing-town" },
    title: "Crossing Cleric Hall",
    description:
      "A quiet annex with altars and treatment stations where healing routines are taught first.",
    prompts: ["The air carries herb scents and candlewax."],
    exits: [{ direction: "down", destination: "crossing-TG01-001", details: "Return to the town green." }],
    guild: "cleric",
    shop: {
      code: "crossing-cleric-market",
      name: "Cleric Outfitters",
      items: [
        { code: "itm-healing-balm", name: "healing balm", price: 6, currency: "trias" },
        { code: "itm-wound-cloth", name: "cleaning cloth", price: 2, currency: "trias" },
      ],
    },
  },
  "crossing-GU06-001": {
    id: "crossing-GU06-001",
    code: { town: "crossing", square: "GU06", zone: "crossing-town" },
    title: "Crossing Bard Conservatory",
    description: "Practice rooms, performance ledgers, and echoing lecture spaces fill the conservatory.",
    prompts: ["A mentor taps time against a music stand."],
    exits: [{ direction: "south", destination: "crossing-IN02-001", details: "Return to Inns Row." }],
    guild: "bard",
    shop: {
      code: "crossing-bard-supply",
      name: "Bard Conservatory Stores",
      items: [
        { code: "itm-practice-lute", name: "practice lute", price: 9, currency: "plat" },
        { code: "itm-rosin-cake", name: "rosin cake", price: 3, currency: "trias" },
      ],
    },
  },
  "crossing-GU07-001": {
    id: "crossing-GU07-001",
    code: { town: "crossing", square: "GU07", zone: "crossing-town" },
    title: "Crossing Trader Exchange",
    description: "Ledger desks, weighing hooks, and sample crates line a busy commercial floor.",
    prompts: ["A clerk calls exchange rates over the room noise."],
    exits: [{ direction: "west", destination: "crossing-IN02-001", details: "Return to Inns Row." }],
    guild: "trader",
    shop: {
      code: "crossing-trader-exchange",
      name: "Trader Exchange Counter",
      items: [
        { code: "itm-ledger-book", name: "ledger book", price: 6, currency: "plat" },
        { code: "itm-weighing-string", name: "weighing string", price: 2, currency: "trias" },
      ],
    },
  },
  "crossing-GU08-001": {
    id: "crossing-GU08-001",
    code: { town: "crossing", square: "GU08", zone: "crossing-town" },
    title: "Crossing Empath Clinic",
    description: "Treatment cots and quiet instruction alcoves support careful recovery practice.",
    prompts: ["An instructor reminds students to observe before acting."],
    exits: [{ direction: "east", destination: "crossing-IN02-001", details: "Return to Inns Row." }],
    guild: "empath",
    shop: {
      code: "crossing-empath-clinic",
      name: "Empath Clinic Stores",
      items: [
        { code: "itm-bandage-roll", name: "bandage roll", price: 4, currency: "trias" },
        { code: "itm-clinic-apron", name: "clinic apron", price: 5, currency: "plat" },
      ],
    },
  },
  "crossing-GU09-001": {
    id: "crossing-GU09-001",
    code: { town: "crossing", square: "GU09", zone: "crossing-town" },
    title: "Crossing Paladin Yard",
    description: "Shield posts, oath stones, and formation lanes mark a disciplined training yard.",
    prompts: ["A yard captain watches footwork and shield angles."],
    exits: [{ direction: "west", destination: "crossing-MA01-001", details: "Return to Marksman Way." }],
    guild: "paladin",
    shop: {
      code: "crossing-paladin-yard",
      name: "Paladin Yard Quartermaster",
      items: [
        { code: "itm-practice-shield", name: "practice shield", price: 11, currency: "plat" },
        { code: "itm-oath-cord", name: "oath cord", price: 4, currency: "trias" },
      ],
    },
  },
  "crossing-GU10-001": {
    id: "crossing-GU10-001",
    code: { town: "crossing", square: "GU10", zone: "crossing-town" },
    title: "Crossing Barbarian Pit",
    description: "Packed earth, heavy posts, and rhythm drills make the pit direct and demanding.",
    prompts: ["A trainer barks for cleaner recovery after each strike."],
    exits: [{ direction: "west", destination: "crossing-RV01-001", details: "Return to South Gate Road." }],
    guild: "barbarian",
    shop: {
      code: "crossing-barbarian-pit",
      name: "Barbarian Pit Rack",
      items: [
        { code: "itm-weighted-club", name: "weighted club", price: 10, currency: "plat" },
        { code: "itm-grip-wrap", name: "grip wrap", price: 3, currency: "trias" },
      ],
    },
  },
  "crossing-GU11-001": {
    id: "crossing-GU11-001",
    code: { town: "crossing", square: "GU11", zone: "crossing-town" },
    title: "Crossing Warrior Mage Range",
    description: "Target lanes are scorched from controlled elemental drills and weapon forms.",
    prompts: ["An instructor times spell focus against weapon recovery."],
    exits: [{ direction: "east", destination: "crossing-RV01-001", details: "Return to South Gate Road." }],
    guild: "warrior_mage",
    shop: {
      code: "crossing-warrior-mage-range",
      name: "Warrior Mage Field Stores",
      items: [
        { code: "itm-channeling-rod", name: "channeling rod", price: 13, currency: "plat" },
        { code: "itm-charcoal-dust", name: "charcoal dust", price: 3, currency: "trias" },
      ],
    },
  },
  "crossing-GU12-001": {
    id: "crossing-GU12-001",
    code: { town: "crossing", square: "GU12", zone: "crossing-town" },
    title: "Crossing Moon Mage Observatory",
    description: "Star charts, calculation boards, and quiet telescope bays fill a domed study.",
    prompts: ["A student revises a prediction table in chalk."],
    exits: [{ direction: "south", destination: "crossing-GU02-001", details: "Return to the Arcane Study Hall." }],
    guild: "moon_mage",
    shop: {
      code: "crossing-moon-mage-observatory",
      name: "Observatory Supply Desk",
      items: [
        { code: "itm-star-chart", name: "starter star chart", price: 8, currency: "plat" },
        { code: "itm-chalk-bundle", name: "chalk bundle", price: 2, currency: "trias" },
      ],
    },
  },
  "crossing-GU13-001": {
    id: "crossing-GU13-001",
    code: { town: "crossing", square: "GU13", zone: "crossing-town" },
    title: "Crossing Lower Study",
    description: "A sealed lower room contains heavily supervised theory drills and restricted shelves.",
    prompts: ["The lower study is quiet enough to hear page edges scrape."],
    exits: [{ direction: "up", destination: "crossing-GU02-001", details: "Return to the Arcane Study Hall." }],
    guild: "necromancer",
    shop: {
      code: "crossing-lower-study",
      name: "Restricted Study Stores",
      items: [
        { code: "itm-ink-black", name: "black study ink", price: 5, currency: "trias" },
        { code: "itm-sealed-notes", name: "sealed notes", price: 15, currency: "plat" },
      ],
    },
  },
  "crossing-GU14-001": {
    id: "crossing-GU14-001",
    code: { town: "crossing", square: "GU14", zone: "crossing-town" },
    title: "Crossing Ranger Field Room",
    description: "Trail signs, weathered maps, and controlled fieldcraft exercises occupy a lean annex.",
    prompts: ["A pathfinder sorts tracks by depth and direction."],
    exits: [{ direction: "west", destination: "crossing-GU03-001", details: "Return to the Trail Scout Lodge." }],
    guild: "ranger",
    shop: {
      code: "crossing-ranger-field-room",
      name: "Ranger Field Stores",
      items: [
        { code: "itm-trail-knife", name: "trail knife", price: 8, currency: "plat" },
        { code: "itm-weather-twine", name: "weather twine", price: 3, currency: "trias" },
      ],
    },
  },
  "crossing-GU15-001": {
    id: "crossing-GU15-001",
    code: { town: "crossing", square: "GU15", zone: "crossing-town" },
    title: "Crossing Thief Practice Room",
    description: "Practice locks, blind corners, and quiet obstacle stations shape a compact training room.",
    prompts: ["A trainer marks the sound of every careless step."],
    exits: [{ direction: "east", destination: "crossing-GU04-001", details: "Return to the Shadowed Utility Hall." }],
    guild: "thief",
    shop: {
      code: "crossing-thief-practice",
      name: "Thief Practice Stores",
      items: [
        { code: "itm-practice-lock", name: "practice lock", price: 7, currency: "plat" },
        { code: "itm-soft-sole-wrap", name: "soft sole wrap", price: 4, currency: "trias" },
      ],
    },
  },
};

export const guilds: Guild[] = [
  { id: "barbarian", name: "Barbarian Guild", roomId: "crossing-GU10-001" },
  { id: "bard", name: "Bard Guild", roomId: "crossing-GU06-001" },
  { id: "moon_mage", name: "Moon Mage Guild", roomId: "crossing-GU12-001" },
  { id: "necromancer", name: "Necromancer Guild", roomId: "crossing-GU13-001" },
  { id: "paladin", name: "Paladin Guild", roomId: "crossing-GU09-001" },
  { id: "ranger", name: "Ranger Guild", roomId: "crossing-GU14-001" },
  { id: "thief", name: "Thief Guild", roomId: "crossing-GU15-001" },
  { id: "trader", name: "Trader Guild", roomId: "crossing-GU07-001" },
  { id: "warrior_mage", name: "Warrior Mage Guild", roomId: "crossing-GU11-001" },
  { id: "cleric", name: "Cleric Guild", roomId: "crossing-GU05-001" },
  { id: "empath", name: "Empath Guild", roomId: "crossing-GU08-001" },
];

export const directionAliases: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
  u: "up",
  d: "down",
  enter: "enter",
  out: "exit",
};

export function normalizeDirection(input: string): string {
  const normalized = input.toLowerCase().trim();
  if (directionAliases[normalized]) return directionAliases[normalized];
  const cleaned = normalized.replace(/^go\s+/, '');
  if (directionAliases[cleaned]) return directionAliases[cleaned];
  return cleaned;
}

export function resolveMovementDecision(
  command: string,
  room: Room,
  rooms: Record<RoomId, Room> = worldRooms,
): MovementDecision {
  const direction = normalizeDirection(command);
  const target = room.exits.find((exit) => exit.direction.toLowerCase() === direction);
  if (!target) {
    return {
      moved: false,
      reason: 'unknown_command',
      direction,
      events: [`Unknown command: ${command}`],
    };
  }

  const nextRoom = rooms[target.destination];
  if (!nextRoom) {
    return {
      moved: false,
      reason: 'broken_exit',
      direction,
      events: ['That path is broken in the world data.'],
    };
  }

  return {
    moved: true,
    direction,
    nextRoom,
    events: [`You go ${direction} to ${nextRoom.title}.`],
  };
}
