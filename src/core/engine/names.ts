/**
 * Name pools for fictional players and NPC clubs.
 * Per chapter 9 (naming rights) only invented or clearly altered names are
 * used - no real player, club or league names.
 */

export const FIRST_NAMES = [
  'Alfie', 'Bruno', 'Callum', 'Dario', 'Enzo', 'Finn', 'Gino', 'Harvey', 'Iker', 'Jayden',
  'Kofi', 'Luca', 'Mason', 'Nilo', 'Oscar', 'Pablo', 'Quinn', 'Ronny', 'Santi', 'Tyrese',
  'Umar', 'Vito', 'Wesley', 'Xavi', 'Yannick', 'Zack', 'Ade', 'Bo', 'Cyrus', 'Dex',
  'Eli', 'Fabio', 'Grady', 'Hugo', 'Idris', 'Jonah', 'Kian', 'Leo', 'Milo', 'Nate',
  'Otis', 'Pele-Jay', 'Rufus', 'Sonny', 'Theo', 'Ugo', 'Vinnie', 'Walt', 'Yusuf', 'Zane',
];

export const LAST_NAMES = [
  'Strikefield', 'Ballhorn', 'Kickman', 'Netkeeper', 'Wingblade', 'Turfmeyer', 'Cornerstone',
  'Volleyman', 'Dribbleton', 'Slidewell', 'Postwood', 'Crossbar', 'Nutmegson', 'Offsider',
  'Counterman', 'Pressley', 'Templeford', 'Shinbridge', 'Studsworth', 'Freekicker',
  'Penfold', 'Hattrickson', 'Passmore', 'Backheeler', 'Bouncer', 'Squarepass', 'Throughman',
  'Lofton', 'Chipwell', 'Curlington', 'Finisher', 'Wallplay', 'Sixton', 'Tenner',
  'Sweeperton', 'Markwell', 'Stopperfield', 'Clearman', 'Ballerino', 'Combino',
  'Tikitakos', 'Counterpress', 'Switchplay', 'Boxton', 'Catchwell', 'Saveson',
  'Diverton', 'Fistwell', 'Boxridge', 'Rebounder',
];

/** The three selectable starters: invented left wingers (chapter 2.2). */
export const STARTER_WINGERS = [
  { name: 'David Neris', flavor: 'Explosive attacker with a turbo first step' },
  { name: 'Jan Demande', flavor: 'Tricky forward with silky technique' },
  { name: 'Notling Elmejor', flavor: 'Ice-cold finisher in the box' },
];

/**
 * Kuratierte Gold-/Legendär-Identitäten: erkennbare Stars mit klar
 * abgewandelten Fantasienamen (Kapitel 9: keine echten Namen).
 * Anzahl muss zur Pool-Größe in playerGen passen (20 Gold, 10 Legendär).
 */
export const LEGENDARY_PLAYERS: Array<{ name: string; position: 'TW' | 'ABW' | 'MF' | 'ST' }> = [
  { name: 'Leo Mezzi', position: 'ST' },
  { name: 'Cristiano Ronalgo', position: 'ST' },
  { name: 'Kilian Mbappo', position: 'ST' },
  { name: 'Erling Hooland', position: 'ST' },
  { name: 'Kevin De Bruggen', position: 'MF' },
  { name: 'Luka Modrego', position: 'MF' },
  { name: 'Jude Bellingden', position: 'MF' },
  { name: 'Virgil van Dike', position: 'ABW' },
  { name: 'Achraf Hakimo', position: 'ABW' },
  { name: 'Gigi Donnaromma', position: 'TW' },
];

export const GOLD_PLAYERS: Array<{ name: string; position: 'TW' | 'ABW' | 'MF' | 'ST' }> = [
  { name: 'Harry Kanet', position: 'ST' },
  { name: 'Lautaro Martinello', position: 'ST' },
  { name: 'Victor Osimenne', position: 'ST' },
  { name: 'Son Heungmino', position: 'ST' },
  { name: 'Rafael Leaon', position: 'ST' },
  { name: 'Julian Alvarest', position: 'ST' },
  { name: 'Jamal Musialo', position: 'MF' },
  { name: 'Phil Fodden', position: 'MF' },
  { name: 'Pedri Gonzalvez', position: 'MF' },
  { name: 'Rodri Hernandes', position: 'MF' },
  { name: 'Florian Wirtzel', position: 'MF' },
  { name: 'Declan Rike', position: 'MF' },
  { name: 'Martin Odegoal', position: 'MF' },
  { name: 'Ruben Diaz', position: 'ABW' },
  { name: 'Trent Arnoldson', position: 'ABW' },
  { name: 'Theo Hernandes', position: 'ABW' },
  { name: 'Willy Salibar', position: 'ABW' },
  { name: 'Josko Guardiol', position: 'ABW' },
  { name: 'Alisson Beckert', position: 'TW' },
  { name: 'Thibaut Courtoise', position: 'TW' },
];

/** Prefixes go before the place name ("FC Misthill"), suffixes after ("Misthill Rovers"). */
export const NPC_CLUB_PREFIXES = ['FC', 'Athletic', 'Real', 'Sporting', 'Dynamo'];
export const NPC_CLUB_SUFFIXES = ['United', 'Rovers', 'Wanderers', 'City', 'Town'];

export const NPC_CLUB_PLACES = [
  'Misthill', 'Stonebrook', 'Cloudmere', 'Highkick', 'Ballstead', 'Greenfield', 'Goalhaven',
  'Turfholm', 'Floodlight', 'Cornerdale', 'Postbury', 'Crossbridge', 'Kickerton',
  'Stormhage', 'Kickoff Vale', 'Netherfield', 'Counterford', 'Dribbleburn', 'Wingdale',
  'Netham', 'Boxmoor', 'Awayside', 'Homewin', 'Doublepass',
];
