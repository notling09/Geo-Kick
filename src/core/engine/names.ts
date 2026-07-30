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
 * Kuratierte Gold-/Legendär-Identitäten: erkennbare Stars mit klar
 * abgewandelten Fantasienamen (Kapitel 9: keine echten Namen).
 * Anzahl muss zur Pool-Größe in playerGen passen (40 Gold, 20 Legendär).
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
  { name: 'Neymar Junius', position: 'ST' },
  { name: 'Zlatan Ibrakadabra', position: 'ST' },
  { name: 'Franco Beckenbauner', position: 'ABW' },
  { name: 'Roberto Carlot', position: 'ABW' },
  { name: 'Toni Kroon', position: 'MF' },
  { name: 'Zinedine Zidano', position: 'MF' },
  { name: 'Ronaldinho Gauchito', position: 'MF' },
  { name: 'Sergio Ramoz', position: 'ABW' },
  { name: 'Paolo Maldino', position: 'ABW' },
  { name: 'Manuel Neuwer', position: 'TW' },
  // V7.2: Pool verdoppelt
  { name: 'Pele Nascimo', position: 'ST' },
  { name: 'Diego Maradonno', position: 'ST' },
  { name: 'Johan Cruyfen', position: 'ST' },
  { name: 'George Besto', position: 'ST' },
  { name: 'Marco van Basto', position: 'ST' },
  { name: 'Gerd Mullen', position: 'ST' },
  { name: 'Ferenc Puskaz', position: 'ST' },
  { name: 'Eusebio Silvo', position: 'ST' },
  { name: 'Michel Platano', position: 'MF' },
  { name: 'Ruud Gullito', position: 'MF' },
  { name: 'Andres Iniesto', position: 'MF' },
  { name: 'Xavi Hernandes', position: 'MF' },
  { name: 'Andrea Pirloni', position: 'MF' },
  { name: 'Ricardo Kakao', position: 'MF' },
  { name: 'Bobby Charleton', position: 'MF' },
  { name: 'Alfredo di Stefano', position: 'ST' },
  { name: 'Thierry Henrico', position: 'ST' },
  { name: 'Didier Drogban', position: 'ST' },
  { name: 'Cafu Marcos', position: 'ABW' },
  { name: 'Fabio Cannavart', position: 'ABW' },
  { name: 'Lev Yashen', position: 'TW' },
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
  { name: 'Ronald Araujoo', position: 'ABW' },
  { name: 'Ousmane Dembelo', position: 'ST' },
  { name: 'Marcus Rushford', position: 'ST' },
  { name: 'Marquinhoz', position: 'ABW' },
  { name: 'Khvicha Kvaradona', position: 'ST' },
  { name: 'Alexander Isaak', position: 'ST' },
  { name: 'Bruno Fernandez', position: 'MF' },
  { name: 'Bernardo Silvano', position: 'MF' },
  { name: 'Frenkie de Jongen', position: 'MF' },
  { name: 'Enzo Fernandel', position: 'MF' },
  { name: 'Robert Lewandowsko', position: 'ST' },
  { name: 'Antoine Griezmanno', position: 'ST' },
  { name: 'Ilkay Gundowin', position: 'MF' },
  { name: 'Antonio Rudige', position: 'ABW' },
  { name: 'Alphonso Davios', position: 'ABW' },
  { name: 'Kyle Walkman', position: 'ABW' },
  { name: 'Matthijs de Ligth', position: 'ABW' },
  { name: 'Dayot Upamecanoe', position: 'ABW' },
  { name: 'Ederson Moralez', position: 'TW' },
  { name: 'Mike Maignano', position: 'TW' },
  // V7.2 verdoppelt, V7.4 auf aktuelle 2026-Stars aufgefrischt
  { name: 'Lamin Yamol', position: 'ST' },
  { name: 'Niko Willians', position: 'ST' },
  { name: 'Endryk Felib', position: 'ST' },
  { name: 'Vitor Roky', position: 'ST' },
  { name: 'Ben Sesko', position: 'ST' },
  { name: 'Victor Bonifas', position: 'ST' },
  { name: 'Hugo Ekitiko', position: 'ST' },
  { name: 'Rasmus Hojlend', position: 'ST' },
  { name: 'Mateo Retegi', position: 'ST' },
  { name: 'Serhou Guirass', position: 'ST' },
  { name: 'Darwin Nunes', position: 'ST' },
  { name: 'Gabriel Jesuz', position: 'ST' },
  { name: 'Warren Zaire', position: 'MF' },
  { name: 'Kobi Maynoo', position: 'MF' },
  { name: 'Joao Nevis', position: 'MF' },
  { name: 'Desir Douay', position: 'MF' },
  { name: 'Xavi Simmons', position: 'MF' },
  { name: 'Micha Oliso', position: 'MF' },
  { name: 'Arda Gulor', position: 'MF' },
  { name: 'Cole Palmar', position: 'MF' },
  { name: 'Nico Gonzalo', position: 'MF' },
  { name: 'Adam Wharten', position: 'MF' },
  { name: 'Alex Garnacho', position: 'MF' },
  { name: 'Savio Ferra', position: 'MF' },
  { name: 'Manu Kone', position: 'MF' },
  { name: 'Carlos Baleba', position: 'MF' },
  { name: 'Pau Cubarso', position: 'ABW' },
  { name: 'Jarrad Branthwait', position: 'ABW' },
  { name: 'Leny Yoro', position: 'ABW' },
  { name: 'Castello Lukeba', position: 'ABW' },
  { name: 'Riccardo Calafior', position: 'ABW' },
  { name: 'Nuno Mendos', position: 'ABW' },
  { name: 'Alejandro Balde', position: 'ABW' },
  { name: 'Micky van de Ven', position: 'ABW' },
  { name: 'Levi Colwin', position: 'ABW' },
  { name: 'Malo Gusto', position: 'ABW' },
  { name: 'Diogo Costo', position: 'TW' },
  { name: 'Bart Verbrugen', position: 'TW' },
  { name: 'Filip Jorgensen', position: 'TW' },
  { name: 'Guglielmo Vicaro', position: 'TW' },
  { name: 'Lucas Chevalar', position: 'TW' },
];

/**
 * Feste Gold-Ratings (V7.4): Statt eines Zufallswerts 75–85 bekommt jeder
 * Gold-Star ein Overall, das seiner realen Qualität entspricht (angelehnt an
 * aktuelle FIFA-/Weltklasse-Einschätzungen 2026). So sind Top-Spieler wie
 * Yamal oder Dembélé oben, junge/unfertige wie Retegi unten in der Gold-Stufe.
 * Namen, die hier nicht vorkommen, fallen auf den Zufallsbereich zurück.
 */
export const STAR_OVERALL: Record<string, number> = {
  // Etablierte Weltklasse (Gold-Oberkante)
  'Harry Kanet': 87,
  'Rodri Hernandes': 88,
  'Lamin Yamol': 87,
  'Ousmane Dembelo': 87,
  'Robert Lewandowsko': 87,
  'Thibaut Courtoise': 87,
  'Lautaro Martinello': 86,
  'Jamal Musialo': 86,
  'Pedri Gonzalvez': 86,
  'Florian Wirtzel': 86,
  'Khvicha Kvaradona': 86,
  'Bruno Fernandez': 86,
  'Alisson Beckert': 86,
  'Mike Maignano': 86,
  'Cole Palmar': 86,
  // Sehr stark
  'Victor Osimenne': 85,
  'Julian Alvarest': 85,
  'Phil Fodden': 85,
  'Martin Odegoal': 85,
  'Ruben Diaz': 85,
  'Willy Salibar': 85,
  'Alexander Isaak': 85,
  'Bernardo Silvano': 85,
  'Frenkie de Jongen': 85,
  'Antoine Griezmanno': 85,
  'Antonio Rudige': 85,
  'Ederson Moralez': 85,
  'Diogo Costo': 85,
  // Stark
  'Son Heungmino': 84,
  'Rafael Leaon': 84,
  'Declan Rike': 84,
  'Trent Arnoldson': 84,
  'Theo Hernandes': 84,
  'Ronald Araujoo': 84,
  'Marquinhoz': 84,
  'Enzo Fernandel': 84,
  'Matthijs de Ligth': 84,
  'Niko Willians': 84,
  'Micha Oliso': 84,
  'Nuno Mendos': 84,
  'Josko Guardiol': 83,
  'Dayot Upamecanoe': 83,
  'Joao Nevis': 83,
  'Xavi Simmons': 83,
  'Pau Cubarso': 83,
  'Guglielmo Vicaro': 83,
  // Solide Gold
  'Marcus Rushford': 82,
  'Ilkay Gundowin': 82,
  'Alphonso Davios': 82,
  'Ben Sesko': 82,
  'Serhou Guirass': 82,
  'Warren Zaire': 82,
  'Desir Douay': 82,
  'Arda Gulor': 82,
  'Alejandro Balde': 82,
  'Micky van de Ven': 82,
  'Lucas Chevalar': 82,
  'Kyle Walkman': 81,
  'Hugo Ekitiko': 81,
  'Darwin Nunes': 81,
  'Gabriel Jesuz': 81,
  'Alex Garnacho': 81,
  'Savio Ferra': 81,
  'Manu Kone': 81,
  'Jarrad Branthwait': 81,
  'Leny Yoro': 81,
  'Riccardo Calafior': 81,
  'Levi Colwin': 81,
  // Untere Gold-Stufe (jung/unfertig – „gerade noch Gold")
  'Victor Bonifas': 80,
  'Kobi Maynoo': 80,
  'Nico Gonzalo': 80,
  'Carlos Baleba': 80,
  'Castello Lukeba': 80,
  'Adam Wharten': 80,
  'Endryk Felib': 79,
  'Rasmus Hojlend': 79,
  'Malo Gusto': 79,
  'Bart Verbrugen': 79,
  'Mateo Retegi': 78,
  'Filip Jorgensen': 78,
  'Vitor Roky': 77,
};

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
