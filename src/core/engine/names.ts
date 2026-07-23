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
  // V7.2: Pool verdoppelt
  { name: 'Mohamed Salano', position: 'ST' },
  { name: 'Sadio Manne', position: 'ST' },
  { name: 'Karim Benzemo', position: 'ST' },
  { name: 'Luis Suarest', position: 'ST' },
  { name: 'Sergio Aguerro', position: 'ST' },
  { name: 'Gareth Balo', position: 'ST' },
  { name: 'Eden Hazardo', position: 'ST' },
  { name: 'Darwin Nunes', position: 'ST' },
  { name: 'Cody Gakpoo', position: 'ST' },
  { name: 'Memphis Depai', position: 'ST' },
  { name: 'Richarleson', position: 'ST' },
  { name: 'Gabriel Jesuz', position: 'ST' },
  { name: 'Paul Pogban', position: 'MF' },
  { name: 'Ngolo Kanto', position: 'MF' },
  { name: 'Sergio Busketz', position: 'MF' },
  { name: 'Casimiro Alvez', position: 'MF' },
  { name: 'Joshua Kimmen', position: 'MF' },
  { name: 'Leon Goretzko', position: 'MF' },
  { name: 'Marco Reuss', position: 'MF' },
  { name: 'Thomas Mullen', position: 'MF' },
  { name: 'Serge Gnabri', position: 'MF' },
  { name: 'Leroy Sano', position: 'MF' },
  { name: 'Raheem Sterlin', position: 'MF' },
  { name: 'Jack Grealesh', position: 'MF' },
  { name: 'Bukayo Sako', position: 'MF' },
  { name: 'Mason Mounto', position: 'MF' },
  { name: 'Raphael Varano', position: 'ABW' },
  { name: 'David Alabo', position: 'ABW' },
  { name: 'Joao Cancelio', position: 'ABW' },
  { name: 'Reece Jamez', position: 'ABW' },
  { name: 'Andrew Robertsen', position: 'ABW' },
  { name: 'Jules Koundo', position: 'ABW' },
  { name: 'Presnel Kimpembo', position: 'ABW' },
  { name: 'Dani Alvez', position: 'ABW' },
  { name: 'Marcelo Vieri', position: 'ABW' },
  { name: 'Ben Chilwer', position: 'ABW' },
  { name: 'Marc ter Stegan', position: 'TW' },
  { name: 'Wojciech Szczesni', position: 'TW' },
  { name: 'Yann Sommen', position: 'TW' },
  { name: 'Kepa Arizabal', position: 'TW' },
  { name: 'Gregor Kobelo', position: 'TW' },
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
