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
 * Kuratierte Star-Identitäten (V7.5): erkennbare Spieler mit klar
 * abgewandelten Fantasienamen (Kapitel 9). Jeder Eintrag trägt sein festes
 * Overall (angelehnt an aktuelles FIFA/Weltfußball 2026).
 *  - Legendary = 75 Größte aller Zeiten + aktuelle Weltklasse, Rating 86–93
 *    (nur Messi & Ronaldo = 93).
 *  - Gold = 125 nächstbeste aktive Spieler, Rating 75–85.
 * STAR_OVERALL wird unten direkt aus diesen Listen abgeleitet.
 */
export interface StarEntry {
  name: string;
  position: 'TW' | 'ABW' | 'MF' | 'ST';
  overall: number;
}

export const LEGENDARY_PLAYERS: StarEntry[] = [
  { name: 'Leo Mezzi', position: 'MF', overall: 93 },
  { name: 'Cristiano Ronalgo', position: 'ST', overall: 93 },
  { name: 'Pele Nascimo', position: 'ST', overall: 92 },
  { name: 'Diego Maradonno', position: 'MF', overall: 92 },
  { name: 'Kilian Mbappo', position: 'ST', overall: 91 },
  { name: 'Erling Hooland', position: 'ST', overall: 91 },
  { name: 'Johan Cruyfen', position: 'ST', overall: 91 },
  { name: 'Zinedine Zidano', position: 'MF', overall: 91 },
  { name: 'Ronaldo Nazaro', position: 'ST', overall: 91 },
  { name: 'Jude Bellingden', position: 'MF', overall: 90 },
  { name: 'Rodri Hernandes', position: 'MF', overall: 90 },
  { name: 'Franco Beckenbauner', position: 'ABW', overall: 90 },
  { name: 'Alfredo di Stefano', position: 'ST', overall: 90 },
  { name: 'Ronaldinho Gauchito', position: 'MF', overall: 90 },
  { name: 'Paolo Maldino', position: 'ABW', overall: 90 },
  { name: 'Ferenc Puskaz', position: 'ST', overall: 90 },
  { name: 'Vinicius Junio', position: 'ST', overall: 89 },
  { name: 'Lamin Yamol', position: 'ST', overall: 89 },
  { name: 'Mohamed Salano', position: 'ST', overall: 89 },
  { name: 'Marco van Basto', position: 'ST', overall: 89 },
  { name: 'Gerd Mullen', position: 'ST', overall: 89 },
  { name: 'Michel Platano', position: 'MF', overall: 89 },
  { name: 'Eusebio Silvo', position: 'ST', overall: 89 },
  { name: 'Lev Yashen', position: 'TW', overall: 89 },
  { name: 'Xavi Hernandes', position: 'MF', overall: 89 },
  { name: 'Andres Iniesto', position: 'MF', overall: 89 },
  { name: 'Thierry Henrico', position: 'ST', overall: 89 },
  { name: 'Zico Antuno', position: 'MF', overall: 89 },
  { name: 'Garrincho Mano', position: 'MF', overall: 89 },
  { name: 'Gigi Buffo', position: 'TW', overall: 89 },
  { name: 'Kevin De Bruggen', position: 'MF', overall: 88 },
  { name: 'Harry Kanet', position: 'ST', overall: 88 },
  { name: 'Virgil van Dike', position: 'ABW', overall: 88 },
  { name: 'Thibaut Courtoise', position: 'TW', overall: 88 },
  { name: 'Ousmane Dembelo', position: 'ST', overall: 88 },
  { name: 'Franco Baresini', position: 'ABW', overall: 88 },
  { name: 'Fabio Cannavart', position: 'ABW', overall: 88 },
  { name: 'Iker Casillo', position: 'TW', overall: 88 },
  { name: 'Manuel Neuwer', position: 'TW', overall: 88 },
  { name: 'Andrea Pirloni', position: 'MF', overall: 88 },
  { name: 'Ricardo Kakao', position: 'MF', overall: 88 },
  { name: 'Sergio Ramoz', position: 'ABW', overall: 88 },
  { name: 'Roberto Carlot', position: 'ABW', overall: 88 },
  { name: 'George Besto', position: 'ST', overall: 88 },
  { name: 'Bobby Charleton', position: 'MF', overall: 88 },
  { name: 'Romario Fario', position: 'ST', overall: 88 },
  { name: 'Zlatan Ibrakadabra', position: 'ST', overall: 88 },
  { name: 'Neymar Junius', position: 'ST', overall: 88 },
  { name: 'Luka Modrego', position: 'MF', overall: 88 },
  { name: 'Toni Kroon', position: 'MF', overall: 88 },
  { name: 'Gigi Donnaromma', position: 'TW', overall: 87 },
  { name: 'Jamal Musialo', position: 'MF', overall: 87 },
  { name: 'Khvicha Kvaradona', position: 'ST', overall: 87 },
  { name: 'Lautaro Martinello', position: 'ST', overall: 87 },
  { name: 'Florian Wirtzel', position: 'MF', overall: 87 },
  { name: 'Robert Lewandowsko', position: 'ST', overall: 87 },
  { name: 'Pedri Gonzalvez', position: 'MF', overall: 87 },
  { name: 'Rafinha Diaz', position: 'ST', overall: 87 },
  { name: 'Cafu Marcos', position: 'ABW', overall: 87 },
  { name: 'Ruud Gullito', position: 'MF', overall: 87 },
  { name: 'Didier Drogban', position: 'ST', overall: 87 },
  { name: 'Andriy Shevcheno', position: 'ST', overall: 87 },
  { name: 'Frank Rijkard', position: 'MF', overall: 87 },
  { name: 'Raul Gonzalo', position: 'ST', overall: 87 },
  { name: 'Lothar Mattheus', position: 'MF', overall: 87 },
  { name: 'Rivaldo Vittor', position: 'MF', overall: 87 },
  { name: 'Roberto Bajio', position: 'ST', overall: 87 },
  { name: 'Arjen Robber', position: 'ST', overall: 87 },
  { name: 'Phil Fodden', position: 'MF', overall: 86 },
  { name: 'Luis Figu', position: 'MF', overall: 86 },
  { name: 'Francesco Totto', position: 'ST', overall: 86 },
  { name: 'Steven Gerardo', position: 'MF', overall: 86 },
  { name: 'Frank Lampart', position: 'MF', overall: 86 },
  { name: 'Sandro Nesto', position: 'ABW', overall: 86 },
  { name: 'Bobby Moro', position: 'ABW', overall: 86 },
];

export const GOLD_PLAYERS: StarEntry[] = [
  { name: 'Victor Osimenne', position: 'ST', overall: 85 },
  { name: 'Alexander Isaak', position: 'ST', overall: 85 },
  { name: 'Rodrygo Silvo', position: 'ST', overall: 85 },
  { name: 'Bukayo Sako', position: 'ST', overall: 85 },
  { name: 'Cole Palmar', position: 'MF', overall: 85 },
  { name: 'Fede Valver', position: 'MF', overall: 85 },
  { name: 'Martin Odegoal', position: 'MF', overall: 85 },
  { name: 'Ruben Diaz', position: 'ABW', overall: 85 },
  { name: 'Willy Salibar', position: 'ABW', overall: 85 },
  { name: 'Achraf Hakimo', position: 'ABW', overall: 85 },
  { name: 'Alisson Beckert', position: 'TW', overall: 85 },
  { name: 'Mike Maignano', position: 'TW', overall: 85 },
  { name: 'Julian Alvarest', position: 'ST', overall: 84 },
  { name: 'Viktor Gyokero', position: 'ST', overall: 84 },
  { name: 'Rafael Leaon', position: 'ST', overall: 84 },
  { name: 'Son Heungmino', position: 'ST', overall: 84 },
  { name: 'Bruno Fernandez', position: 'MF', overall: 84 },
  { name: 'Bernardo Silvano', position: 'MF', overall: 84 },
  { name: 'Frenkie de Jongen', position: 'MF', overall: 84 },
  { name: 'Declan Rike', position: 'MF', overall: 84 },
  { name: 'Cuti Romero', position: 'ABW', overall: 84 },
  { name: 'Josko Guardiol', position: 'ABW', overall: 84 },
  { name: 'Sandro Bastono', position: 'ABW', overall: 84 },
  { name: 'Antonio Rudige', position: 'ABW', overall: 84 },
  { name: 'Ederson Moralez', position: 'TW', overall: 84 },
  { name: 'Diogo Costo', position: 'TW', overall: 84 },
  { name: 'Marcus Thurano', position: 'ST', overall: 83 },
  { name: 'Cody Gakpoo', position: 'ST', overall: 83 },
  { name: 'Niko Willians', position: 'ST', overall: 83 },
  { name: 'Dusan Vlahovo', position: 'ST', overall: 83 },
  { name: 'Micha Oliso', position: 'MF', overall: 83 },
  { name: 'Aurel Chouameno', position: 'MF', overall: 83 },
  { name: 'Bruno Guimares', position: 'MF', overall: 83 },
  { name: 'Nico Barello', position: 'MF', overall: 83 },
  { name: 'Jules Koundo', position: 'ABW', overall: 83 },
  { name: 'Reece Jamez', position: 'ABW', overall: 83 },
  { name: 'Theo Hernandes', position: 'ABW', overall: 83 },
  { name: 'Marquinhoz', position: 'ABW', overall: 83 },
  { name: 'Emi Martino', position: 'TW', overall: 83 },
  { name: 'Guglielmo Vicaro', position: 'TW', overall: 83 },
  { name: 'Nico Jaxon', position: 'ST', overall: 82 },
  { name: 'Serhou Guirass', position: 'ST', overall: 82 },
  { name: 'Joshua Kimmen', position: 'MF', overall: 82 },
  { name: 'Enzo Fernandel', position: 'MF', overall: 82 },
  { name: 'Dani Olmar', position: 'MF', overall: 82 },
  { name: 'Pablo Gavo', position: 'MF', overall: 82 },
  { name: 'Xavi Simmons', position: 'MF', overall: 82 },
  { name: 'Trent Arnoldson', position: 'ABW', overall: 82 },
  { name: 'Nuno Mendos', position: 'ABW', overall: 82 },
  { name: 'Alphonso Davios', position: 'ABW', overall: 82 },
  { name: 'Dayot Upamecanoe', position: 'ABW', overall: 82 },
  { name: 'Licha Martino', position: 'ABW', overall: 82 },
  { name: 'David Raia', position: 'TW', overall: 82 },
  { name: 'Andre Onano', position: 'TW', overall: 82 },
  { name: 'Rasmus Hojlend', position: 'ST', overall: 81 },
  { name: 'Randal Kolo', position: 'ST', overall: 81 },
  { name: 'Marcus Rushford', position: 'ST', overall: 81 },
  { name: 'Joao Nevis', position: 'MF', overall: 81 },
  { name: 'Moises Caicero', position: 'MF', overall: 81 },
  { name: 'Alexis MacAlliso', position: 'MF', overall: 81 },
  { name: 'Eduardo Camavigo', position: 'MF', overall: 81 },
  { name: 'Pau Cubarso', position: 'ABW', overall: 81 },
  { name: 'Milan Skrinar', position: 'ABW', overall: 81 },
  { name: 'Fede Dimarco', position: 'ABW', overall: 81 },
  { name: 'Riccardo Calafior', position: 'ABW', overall: 81 },
  { name: 'Eder Milito', position: 'ABW', overall: 81 },
  { name: 'Gregor Kobelo', position: 'TW', overall: 81 },
  { name: 'Jan Oblok', position: 'TW', overall: 81 },
  { name: 'Ben Sesko', position: 'ST', overall: 80 },
  { name: 'Anthony Gordo', position: 'ST', overall: 80 },
  { name: 'Alex Garnacho', position: 'ST', overall: 80 },
  { name: 'Dom Szobo', position: 'MF', overall: 80 },
  { name: 'Arda Gulor', position: 'MF', overall: 80 },
  { name: 'Warren Zaire', position: 'MF', overall: 80 },
  { name: 'Ibra Konato', position: 'ABW', overall: 80 },
  { name: 'Levi Colwin', position: 'ABW', overall: 80 },
  { name: 'Jarrad Branthwait', position: 'ABW', overall: 80 },
  { name: 'Kyle Walkman', position: 'ABW', overall: 80 },
  { name: 'Alex Grimando', position: 'ABW', overall: 80 },
  { name: 'Marc ter Stegan', position: 'TW', overall: 80 },
  { name: 'Yann Sommen', position: 'TW', overall: 80 },
  { name: 'Victor Bonifas', position: 'ST', overall: 79 },
  { name: 'Hugo Ekitiko', position: 'ST', overall: 79 },
  { name: 'Savio Ferra', position: 'ST', overall: 79 },
  { name: 'Manu Kone', position: 'MF', overall: 79 },
  { name: 'Sandro Tonello', position: 'MF', overall: 79 },
  { name: 'Martin Zubimendo', position: 'MF', overall: 79 },
  { name: 'Leny Yoro', position: 'ABW', overall: 79 },
  { name: 'Castello Lukeba', position: 'ABW', overall: 79 },
  { name: 'Jerry Frimpo', position: 'ABW', overall: 79 },
  { name: 'Alejandro Balde', position: 'ABW', overall: 79 },
  { name: 'Lucas Chevalar', position: 'TW', overall: 79 },
  { name: 'Rayan Cherko', position: 'MF', overall: 79 },
  { name: 'Endryk Felib', position: 'ST', overall: 78 },
  { name: 'Joao Felic', position: 'ST', overall: 78 },
  { name: 'Chris Nkunko', position: 'ST', overall: 78 },
  { name: 'Nico Paez', position: 'MF', overall: 78 },
  { name: 'Kobi Maynoo', position: 'MF', overall: 78 },
  { name: 'Elliot Anderso', position: 'MF', overall: 78 },
  { name: 'Malo Gusto', position: 'ABW', overall: 78 },
  { name: 'Marc Cucurelo', position: 'ABW', overall: 78 },
  { name: 'Micky van de Ven', position: 'ABW', overall: 78 },
  { name: 'Destiny Udogo', position: 'ABW', overall: 78 },
  { name: 'Bart Verbrugen', position: 'TW', overall: 78 },
  { name: 'Lois Openda', position: 'ST', overall: 78 },
  { name: 'Mateo Retegi', position: 'ST', overall: 77 },
  { name: 'Jhon Durano', position: 'ST', overall: 77 },
  { name: 'Morgan Gibbs', position: 'MF', overall: 77 },
  { name: 'Eberechi Ezo', position: 'MF', overall: 77 },
  { name: 'Carlos Baleba', position: 'MF', overall: 77 },
  { name: 'Piero Hincapo', position: 'ABW', overall: 77 },
  { name: 'Wesley Fofano', position: 'ABW', overall: 77 },
  { name: 'Mason Mounto', position: 'MF', overall: 77 },
  { name: 'Beto Silva', position: 'ST', overall: 76 },
  { name: 'Jarrod Bowo', position: 'ST', overall: 76 },
  { name: 'Morgan Rogo', position: 'MF', overall: 76 },
  { name: 'Adam Wharten', position: 'MF', overall: 76 },
  { name: 'Milos Kerko', position: 'ABW', overall: 76 },
  { name: 'Anthony Elango', position: 'ST', overall: 76 },
  { name: 'Vitor Roky', position: 'ST', overall: 75 },
  { name: 'Kenan Yildo', position: 'ST', overall: 75 },
  { name: 'Franco Mastano', position: 'MF', overall: 75 },
  { name: 'Josip Sutalo', position: 'ABW', overall: 75 },
  { name: 'Cris Mosquero', position: 'ABW', overall: 75 },
  { name: 'Estevao Willi', position: 'ST', overall: 75 },
];

/**
 * Feste Star-Ratings (V7.5): direkt aus den Listen abgeleitet – der In-Game-
 * Name ist der Schlüssel. Spieler ohne Eintrag (Bronze/Silber) fallen auf den
 * Zufallsbereich zurück.
 */
export const STAR_OVERALL: Record<string, number> = Object.fromEntries(
  [...LEGENDARY_PLAYERS, ...GOLD_PLAYERS].map((p) => [p.name, p.overall]),
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
