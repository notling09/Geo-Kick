import type { Position } from '../domain/types';

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
  { name: 'John Manzamba', flavor: 'Ice-cold finisher in the box' },
];

/**
 * Kuratierte Star-Identitäten (V7.6): erkennbare Spieler mit klar
 * abgewandelten Fantasienamen (Kapitel 9). Jeder Eintrag trägt sein festes
 * Overall UND seine echten Positionen: `position` = Hauptposition (wird auf der
 * Karte gezeigt), `secondary` = weitere Positionen für die Chemie. STAR_OVERALL
 * und STAR_POSITIONS werden unten daraus abgeleitet.
 *  - Legendary = 75 Größte + aktuelle Weltklasse, Rating 86–93.
 *  - Gold = 125 nächstbeste aktive Spieler, Rating 75–85.
 */
export interface StarEntry {
  name: string;
  position: Position;
  secondary?: Position[];
  overall: number;
}

export const LEGENDARY_PLAYERS: StarEntry[] = [
  { name: 'Leo Mezzi', position: 'FL', secondary: ['ST', 'MF'], overall: 93 },
  { name: 'Cristiano Ronalgo', position: 'ST', secondary: ['FL'], overall: 93 },
  { name: 'Pele Nascimo', position: 'ST', secondary: ['FL'], overall: 92 },
  { name: 'Diego Maradonno', position: 'MF', secondary: ['ST', 'FL'], overall: 92 },
  { name: 'Kilian Mbappo', position: 'ST', secondary: ['FL'], overall: 91 },
  { name: 'Erling Hooland', position: 'ST', overall: 91 },
  { name: 'Johan Cruyfen', position: 'ST', secondary: ['FL', 'MF'], overall: 91 },
  { name: 'Zinedine Zidano', position: 'MF', overall: 91 },
  { name: 'Ronaldo Nazaro', position: 'ST', overall: 91 },
  { name: 'Jude Bellingden', position: 'MF', secondary: ['ST'], overall: 90 },
  { name: 'Rodri Hernandes', position: 'MF', secondary: ['CB'], overall: 90 },
  { name: 'Franco Beckenbauner', position: 'CB', secondary: ['MF'], overall: 90 },
  { name: 'Alfredo di Stefano', position: 'ST', secondary: ['MF'], overall: 90 },
  { name: 'Ronaldinho Gauchito', position: 'FL', secondary: ['MF', 'ST'], overall: 90 },
  { name: 'Paolo Maldino', position: 'CB', secondary: ['FB'], overall: 90 },
  { name: 'Ferenc Puskaz', position: 'ST', overall: 90 },
  { name: 'Vinicius Junio', position: 'FL', secondary: ['ST'], overall: 89 },
  { name: 'Lamin Yamol', position: 'FL', secondary: ['ST'], overall: 89 },
  { name: 'Mohamed Salano', position: 'FL', secondary: ['ST'], overall: 89 },
  { name: 'Marco van Basto', position: 'ST', overall: 89 },
  { name: 'Gerd Mullen', position: 'ST', overall: 89 },
  { name: 'Michel Platano', position: 'MF', secondary: ['ST'], overall: 89 },
  { name: 'Eusebio Silvo', position: 'ST', secondary: ['FL'], overall: 89 },
  { name: 'Lev Yashen', position: 'TW', overall: 89 },
  { name: 'Xavi Hernandes', position: 'MF', overall: 89 },
  { name: 'Andres Iniesto', position: 'MF', secondary: ['FL'], overall: 89 },
  { name: 'Thierry Henrico', position: 'ST', secondary: ['FL'], overall: 89 },
  { name: 'Zico Antuno', position: 'MF', secondary: ['ST'], overall: 89 },
  { name: 'Garrincho Mano', position: 'FL', overall: 89 },
  { name: 'Gigi Buffo', position: 'TW', overall: 89 },
  { name: 'Kevin De Bruggen', position: 'MF', secondary: ['FL'], overall: 88 },
  { name: 'Harry Kanet', position: 'ST', secondary: ['MF'], overall: 88 },
  { name: 'Virgil van Dike', position: 'CB', overall: 88 },
  { name: 'Thibaut Courtoise', position: 'TW', overall: 88 },
  { name: 'Ousmane Dembelo', position: 'FL', secondary: ['ST'], overall: 88 },
  { name: 'Franco Baresini', position: 'CB', overall: 88 },
  { name: 'Fabio Cannavart', position: 'CB', overall: 88 },
  { name: 'Iker Casillo', position: 'TW', overall: 88 },
  { name: 'Manuel Neuwer', position: 'TW', overall: 88 },
  { name: 'Andrea Pirloni', position: 'MF', overall: 88 },
  { name: 'Ricardo Kakao', position: 'MF', secondary: ['FL', 'ST'], overall: 88 },
  { name: 'Sergio Ramoz', position: 'CB', secondary: ['FB'], overall: 88 },
  { name: 'Roberto Carlot', position: 'FB', overall: 88 },
  { name: 'George Besto', position: 'FL', secondary: ['ST'], overall: 88 },
  { name: 'Bobby Charleton', position: 'MF', secondary: ['ST'], overall: 88 },
  { name: 'Romario Fario', position: 'ST', overall: 88 },
  { name: 'Zlatan Ibrakadabra', position: 'ST', overall: 88 },
  { name: 'Neymar Junius', position: 'FL', secondary: ['ST', 'MF'], overall: 88 },
  { name: 'Luka Modrego', position: 'MF', overall: 88 },
  { name: 'Toni Kroon', position: 'MF', overall: 88 },
  { name: 'Gigi Donnaromma', position: 'TW', overall: 87 },
  { name: 'Jamal Musialo', position: 'MF', secondary: ['FL'], overall: 87 },
  { name: 'Khvicha Kvaradona', position: 'FL', secondary: ['ST'], overall: 87 },
  { name: 'Lautaro Martinello', position: 'ST', overall: 87 },
  { name: 'Florian Wirtzel', position: 'MF', secondary: ['FL'], overall: 87 },
  { name: 'Robert Lewandowsko', position: 'ST', overall: 87 },
  { name: 'Pedri Gonzalvez', position: 'MF', overall: 87 },
  { name: 'Rafinha Diaz', position: 'FL', secondary: ['ST'], overall: 87 },
  { name: 'Cafu Marcos', position: 'FB', overall: 87 },
  { name: 'Ruud Gullito', position: 'MF', secondary: ['ST', 'FL'], overall: 87 },
  { name: 'Didier Drogban', position: 'ST', overall: 87 },
  { name: 'Andriy Shevcheno', position: 'ST', secondary: ['FL'], overall: 87 },
  { name: 'Frank Rijkard', position: 'MF', secondary: ['CB'], overall: 87 },
  { name: 'Raul Gonzalo', position: 'ST', secondary: ['FL'], overall: 87 },
  { name: 'Lothar Mattheus', position: 'MF', secondary: ['CB'], overall: 87 },
  { name: 'Rivaldo Vittor', position: 'FL', secondary: ['MF', 'ST'], overall: 87 },
  { name: 'Roberto Bajio', position: 'ST', secondary: ['MF'], overall: 87 },
  { name: 'Arjen Robber', position: 'FL', secondary: ['ST'], overall: 87 },
  { name: 'Phil Fodden', position: 'MF', secondary: ['FL'], overall: 86 },
  { name: 'Luis Figu', position: 'FL', secondary: ['MF'], overall: 86 },
  { name: 'Francesco Totto', position: 'ST', secondary: ['MF'], overall: 86 },
  { name: 'Steven Gerardo', position: 'MF', secondary: ['ST'], overall: 86 },
  { name: 'Frank Lampart', position: 'MF', secondary: ['ST'], overall: 86 },
  { name: 'Sandro Nesto', position: 'CB', overall: 86 },
  { name: 'Bobby Moro', position: 'CB', overall: 86 },
];

export const GOLD_PLAYERS: StarEntry[] = [
  { name: 'Victor Osimenne', position: 'ST', overall: 85 },
  { name: 'Alexander Isaak', position: 'ST', overall: 85 },
  { name: 'Rodrygo Silvo', position: 'FL', secondary: ['ST'], overall: 85 },
  { name: 'Bukayo Sako', position: 'FL', secondary: ['ST'], overall: 85 },
  { name: 'Cole Palmar', position: 'MF', secondary: ['FL'], overall: 85 },
  { name: 'Fede Valver', position: 'MF', secondary: ['FB', 'FL'], overall: 85 },
  { name: 'Martin Odegoal', position: 'MF', secondary: ['FL'], overall: 85 },
  { name: 'Ruben Diaz', position: 'CB', overall: 85 },
  { name: 'Willy Salibar', position: 'CB', overall: 85 },
  { name: 'Achraf Hakimo', position: 'FB', secondary: ['FL'], overall: 85 },
  { name: 'Alisson Beckert', position: 'TW', overall: 85 },
  { name: 'Mike Maignano', position: 'TW', overall: 85 },
  { name: 'Julian Alvarest', position: 'ST', secondary: ['FL', 'MF'], overall: 84 },
  { name: 'Viktor Gyokero', position: 'ST', overall: 84 },
  { name: 'Rafael Leaon', position: 'FL', secondary: ['ST'], overall: 84 },
  { name: 'Son Heungmino', position: 'FL', secondary: ['ST'], overall: 84 },
  { name: 'Bruno Fernandez', position: 'MF', secondary: ['FL'], overall: 84 },
  { name: 'Bernardo Silvano', position: 'MF', secondary: ['FL'], overall: 84 },
  { name: 'Frenkie de Jongen', position: 'MF', secondary: ['CB'], overall: 84 },
  { name: 'Declan Rike', position: 'MF', secondary: ['CB'], overall: 84 },
  { name: 'Cuti Romero', position: 'CB', overall: 84 },
  { name: 'Josko Guardiol', position: 'CB', secondary: ['FB'], overall: 84 },
  { name: 'Sandro Bastono', position: 'CB', secondary: ['FB'], overall: 84 },
  { name: 'Antonio Rudige', position: 'CB', secondary: ['FB'], overall: 84 },
  { name: 'Ederson Moralez', position: 'TW', overall: 84 },
  { name: 'Diogo Costo', position: 'TW', overall: 84 },
  { name: 'Marcus Thurano', position: 'ST', secondary: ['FL'], overall: 83 },
  { name: 'Cody Gakpoo', position: 'FL', secondary: ['ST'], overall: 83 },
  { name: 'Niko Willians', position: 'FL', secondary: ['ST'], overall: 83 },
  { name: 'Dusan Vlahovo', position: 'ST', overall: 83 },
  { name: 'Micha Oliso', position: 'FL', secondary: ['MF'], overall: 83 },
  { name: 'Aurel Chouameno', position: 'MF', secondary: ['CB'], overall: 83 },
  { name: 'Bruno Guimares', position: 'MF', overall: 83 },
  { name: 'Nico Barello', position: 'MF', overall: 83 },
  { name: 'Jules Koundo', position: 'FB', secondary: ['CB'], overall: 83 },
  { name: 'Reece Jamez', position: 'FB', secondary: ['MF'], overall: 83 },
  { name: 'Theo Hernandes', position: 'FB', secondary: ['FL'], overall: 83 },
  { name: 'Marquinhoz', position: 'CB', secondary: ['FB'], overall: 83 },
  { name: 'Emi Martino', position: 'TW', overall: 83 },
  { name: 'Guglielmo Vicaro', position: 'TW', overall: 83 },
  { name: 'Nico Jaxon', position: 'ST', secondary: ['FL'], overall: 82 },
  { name: 'Serhou Guirass', position: 'ST', overall: 82 },
  { name: 'Joshua Kimmen', position: 'MF', secondary: ['FB'], overall: 82 },
  { name: 'Enzo Fernandel', position: 'MF', overall: 82 },
  { name: 'Dani Olmar', position: 'MF', secondary: ['FL'], overall: 82 },
  { name: 'Pablo Gavo', position: 'MF', secondary: ['FL'], overall: 82 },
  { name: 'Xavi Simmons', position: 'MF', secondary: ['FL'], overall: 82 },
  { name: 'Trent Arnoldson', position: 'FB', secondary: ['MF'], overall: 82 },
  { name: 'Nuno Mendos', position: 'FB', overall: 82 },
  { name: 'Alphonso Davios', position: 'FB', secondary: ['FL'], overall: 82 },
  { name: 'Dayot Upamecanoe', position: 'CB', overall: 82 },
  { name: 'Licha Martino', position: 'CB', secondary: ['FB'], overall: 82 },
  { name: 'David Raia', position: 'TW', overall: 82 },
  { name: 'Andre Onano', position: 'TW', overall: 82 },
  { name: 'Rasmus Hojlend', position: 'ST', overall: 81 },
  { name: 'Randal Kolo', position: 'ST', secondary: ['FL'], overall: 81 },
  { name: 'Marcus Rushford', position: 'FL', secondary: ['ST'], overall: 81 },
  { name: 'Joao Nevis', position: 'MF', overall: 81 },
  { name: 'Moises Caicero', position: 'MF', overall: 81 },
  { name: 'Alexis MacAlliso', position: 'MF', overall: 81 },
  { name: 'Eduardo Camavigo', position: 'MF', secondary: ['FB'], overall: 81 },
  { name: 'Pau Cubarso', position: 'CB', secondary: ['FB'], overall: 81 },
  { name: 'Milan Skrinar', position: 'CB', overall: 81 },
  { name: 'Fede Dimarco', position: 'FB', secondary: ['CB'], overall: 81 },
  { name: 'Riccardo Calafior', position: 'CB', secondary: ['FB'], overall: 81 },
  { name: 'Eder Milito', position: 'CB', secondary: ['FB'], overall: 81 },
  { name: 'Gregor Kobelo', position: 'TW', overall: 81 },
  { name: 'Jan Oblok', position: 'TW', overall: 81 },
  { name: 'Ben Sesko', position: 'ST', overall: 80 },
  { name: 'Anthony Gordo', position: 'FL', secondary: ['ST'], overall: 80 },
  { name: 'Alex Garnacho', position: 'FL', secondary: ['ST'], overall: 80 },
  { name: 'Dom Szobo', position: 'MF', secondary: ['FL'], overall: 80 },
  { name: 'Arda Gulor', position: 'MF', secondary: ['FL'], overall: 80 },
  { name: 'Warren Zaire', position: 'MF', secondary: ['FB'], overall: 80 },
  { name: 'Ibra Konato', position: 'CB', overall: 80 },
  { name: 'Levi Colwin', position: 'CB', secondary: ['FB'], overall: 80 },
  { name: 'Jarrad Branthwait', position: 'CB', overall: 80 },
  { name: 'Kyle Walkman', position: 'FB', secondary: ['CB'], overall: 80 },
  { name: 'Alex Grimando', position: 'FB', secondary: ['FL'], overall: 80 },
  { name: 'Marc ter Stegan', position: 'TW', overall: 80 },
  { name: 'Yann Sommen', position: 'TW', overall: 80 },
  { name: 'Victor Bonifas', position: 'ST', overall: 79 },
  { name: 'Hugo Ekitiko', position: 'ST', overall: 79 },
  { name: 'Savio Ferra', position: 'FL', secondary: ['ST'], overall: 79 },
  { name: 'Manu Kone', position: 'MF', overall: 79 },
  { name: 'Sandro Tonello', position: 'MF', overall: 79 },
  { name: 'Martin Zubimendo', position: 'MF', overall: 79 },
  { name: 'Leny Yoro', position: 'CB', overall: 79 },
  { name: 'Castello Lukeba', position: 'CB', overall: 79 },
  { name: 'Jerry Frimpo', position: 'FB', secondary: ['FL'], overall: 79 },
  { name: 'Alejandro Balde', position: 'FB', secondary: ['FL'], overall: 79 },
  { name: 'Lucas Chevalar', position: 'TW', overall: 79 },
  { name: 'Rayan Cherko', position: 'MF', secondary: ['FL'], overall: 79 },
  { name: 'Endryk Felib', position: 'ST', overall: 78 },
  { name: 'Joao Felic', position: 'FL', secondary: ['ST', 'MF'], overall: 78 },
  { name: 'Chris Nkunko', position: 'ST', secondary: ['FL', 'MF'], overall: 78 },
  { name: 'Nico Paez', position: 'MF', secondary: ['FL'], overall: 78 },
  { name: 'Kobi Maynoo', position: 'MF', overall: 78 },
  { name: 'Elliot Anderso', position: 'MF', overall: 78 },
  { name: 'Malo Gusto', position: 'FB', overall: 78 },
  { name: 'Marc Cucurelo', position: 'FB', secondary: ['CB'], overall: 78 },
  { name: 'Micky van de Ven', position: 'CB', overall: 78 },
  { name: 'Destiny Udogo', position: 'FB', overall: 78 },
  { name: 'Bart Verbrugen', position: 'TW', overall: 78 },
  { name: 'Lois Openda', position: 'ST', overall: 78 },
  { name: 'Mateo Retegi', position: 'ST', overall: 77 },
  { name: 'Jhon Durano', position: 'ST', overall: 77 },
  { name: 'Morgan Gibbs', position: 'MF', secondary: ['FL'], overall: 77 },
  { name: 'Eberechi Ezo', position: 'FL', secondary: ['MF'], overall: 77 },
  { name: 'Carlos Baleba', position: 'MF', overall: 77 },
  { name: 'Piero Hincapo', position: 'CB', secondary: ['FB'], overall: 77 },
  { name: 'Wesley Fofano', position: 'CB', overall: 77 },
  { name: 'Mason Mounto', position: 'MF', secondary: ['FL'], overall: 77 },
  { name: 'Beto Silva', position: 'ST', overall: 76 },
  { name: 'Jarrod Bowo', position: 'FL', secondary: ['ST'], overall: 76 },
  { name: 'Morgan Rogo', position: 'MF', secondary: ['FL'], overall: 76 },
  { name: 'Adam Wharten', position: 'MF', overall: 76 },
  { name: 'Milos Kerko', position: 'FB', overall: 76 },
  { name: 'Anthony Elango', position: 'FL', secondary: ['ST'], overall: 76 },
  { name: 'Vitor Roky', position: 'ST', overall: 75 },
  { name: 'Kenan Yildo', position: 'FL', secondary: ['ST', 'MF'], overall: 75 },
  { name: 'Franco Mastano', position: 'FL', secondary: ['MF'], overall: 75 },
  { name: 'Josip Sutalo', position: 'CB', overall: 75 },
  { name: 'Cris Mosquero', position: 'CB', overall: 75 },
  { name: 'Estevao Willi', position: 'FL', secondary: ['ST'], overall: 75 },
];

/**
 * Feste Star-Ratings (V7.5): direkt aus den Listen abgeleitet – der In-Game-
 * Name ist der Schlüssel. Spieler ohne Eintrag (Bronze/Silber) fallen auf den
 * Zufallsbereich zurück.
 */
export const STAR_OVERALL: Record<string, number> = Object.fromEntries(
  [...LEGENDARY_PLAYERS, ...GOLD_PLAYERS].map((p) => [p.name, p.overall]),
);

/**
 * Alle für die Chemie zulässigen Positionen je Star (V7.6): Hauptposition
 * zuerst, dann die Nebenpositionen. Nach In-Game-Name. Bronze/Silber-Spieler
 * stehen hier nicht – für sie zählt nur ihre gespeicherte (Haupt-)Position.
 */
export const STAR_POSITIONS: Record<string, Position[]> = Object.fromEntries(
  [...LEGENDARY_PLAYERS, ...GOLD_PLAYERS].map((p) => [
    p.name,
    [p.position, ...(p.secondary ?? [])],
  ]),
);

/** Prefixes go before the place name ("FC Misthill"), suffixes after ("Misthill Rovers"). */
export const NPC_CLUB_PREFIXES = ['FC', 'Athletic', 'Real', 'Sporting', 'Dynamo'];
export const NPC_CLUB_SUFFIXES = ['United', 'Rovers', 'Wanderers', 'City', 'Town'];

export const NPC_CLUB_PLACES = [
  'Misthill', 'Stonebrook', 'Cloudmere', 'Highkick', 'Ballstead', 'Greenfield', 'Goalhaven',
  'Turfholm', 'Floodlight', 'Cornerdale', 'Postbury', 'Crossbridge', 'Kickerton',
  'Stormhage', 'Kickoff Vale', 'Netherfield', 'Counterford', 'Dribbleburn', 'Wingdale',
  'Netham', 'Boxmoor', 'Awayside', 'Homewin', 'Doublepass',
];

/**
 * Champions-League-Teams (V7): an echte Spitzenklubs angelehnt, aber mit
 * abgewandelten Buchstaben – so wie die Spielernamen frei erfunden sind.
 */
export const CL_TEAM_NAMES = [
  'Rial Madryd', 'FC Barcelano', 'Bayarn Munchen', 'Manchestar Sity', 'Livarpool',
  'Paras SG', 'Juvantus', 'Intar Milano', 'AC Milaan', 'Chelsae',
  'Arsenol', 'Dortmond', 'Atletiko Madryd', 'Napolli', 'Portu',
  'Benfika', 'Ajaks', 'Tottanham', 'RB Leipsig', 'Sevilha',
];

/** Zufällige Vereinsnamen für den Nationalen Pokal (V7.2), bewusst generisch. */
export const CUP_TEAM_NAMES = [
  'Riverside United', 'Oakfield Town', 'Kingsbridge FC', 'Ironvale Rovers', 'Norwood Athletic',
  'Ashford City', 'Blackmoor FC', 'Greenhill United', 'Stonewall Town', 'Redcliff Rovers',
  'Whitmore FC', 'Fairwind Athletic', 'Elmwood City', 'Cranford United', 'Harborline FC',
  'Silverbrook Town', 'Thornbury Rovers', 'Westgate United', 'Millrock FC', 'Brookside Athletic',
  'Deanport City', 'Larkfield United', 'Coalburn FC', 'Havenwood Rovers', 'Marshend Town',
];
