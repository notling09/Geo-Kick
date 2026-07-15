import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BALANCING, DISCOVERY, LEAGUE_REWARDS, PACK_TYPES, PITCH_BATTLE, SELL_VALUE, SHOP_PACK_IDS,
} from '../../core/domain/constants';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { colors, font, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Hilfeseite (V3, Nutzerwunsch): erklärt das komplette Spiel an einer
 * Stelle – die langen Infotexte aus dem Packs-Tab leben jetzt hier.
 */

const cooldownMin = BALANCING.spotCooldownMs / 60000;
const matchMin = BALANCING.matchIntervalMs / 60000;

export function HelpScreen({ navigation }: RootScreenProps<'Help'>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>How Geo-Kick works</Text>

        <SectionTitle>Sessions and coins</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Go to a real football pitch and check in on the map (GPS). Stay and play for
            at least 5 minutes - you earn {BALANCING.minCoins} coins, rising up to{' '}
            {BALANCING.maxCoins} coins at 15 minutes, plus exactly one session pack.
            Each session also offers small objectives for bonus coins; the fitness
            objective is verified by your motion sensor.
          </Text>
          <Text style={styles.text}>
            Stay honest: check-in and check-out only work near the pitch, mock locations
            are rejected, and a phone that never moves earns nothing. After a session the
            pitch needs a {cooldownMin} minute cooldown.
          </Text>
        </Card>

        <SectionTitle>Discovering pitches</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Your Pitch Passport (Profile tab) collects every pitch you visit. The first
            rewarded session at a new pitch pays +{DISCOVERY.firstVisitBonusCoins} bonus
            coins, and badges unlock at {DISCOVERY.passportBadges.join(' / ')} different
            pitches.
          </Text>
          <Text style={styles.text}>
            Check in every day to build a daily streak: +{DISCOVERY.streakBonusPerDay}{' '}
            coins per streak day (up to +{DISCOVERY.streakBonusMax}). Miss a day and it
            resets.
          </Text>
          <Text style={styles.text}>
            The pitch you visit most (at least {DISCOVERY.homeMinVisits} times) becomes
            your home ground - blue pin on the map, +{DISCOVERY.homeBonusCoins} bonus
            coins per session, and it levels up as you keep coming back.
          </Text>
        </Card>

        <SectionTitle>Pitch battles and the pitch of the day</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Every pitch has its own team. Challenge it while you are physically there -
            even during a running session - once per pitch per day. Winning earns a
            session pack, losing earns nothing.
            There are no draws: after 90 minutes it goes to a penalty shootout - you
            pick the corner for every shot AND the dive for every save (the keeper
            guesses one of five spots, so 4 out of 5 shots go in).
          </Text>
          <Text style={styles.text}>
            One pitch per day is special (gold pin) - always picked near your current
            location, so travelling shows you a new one. A much stronger boss team
            waits there: beat it for +{PITCH_BATTLE.bossWinReward} coins and points,
            and sessions at that pitch pay double coins all day.
          </Text>
        </Card>

        <SectionTitle>Eggs</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Finish a session to find an egg (1, 3 or 5 km) - you can carry up to 3 at
            once, and they all hatch from the same walking distance. Your distance
            counts while the app is open. Longer eggs hatch better players - a 5 km
            egg can never contain a Bronze player. Hatch them in the Packs tab.
          </Text>
        </Card>

        <SectionTitle>Packs</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Every pack contains {BALANCING.playersPerPack} players, revealed from weakest
            to best. The shop sells stronger packs with better odds:{' '}
            {SHOP_PACK_IDS.map((id) => `${PACK_TYPES[id].label} (${PACK_TYPES[id].price} coins)`).join(', ')}.
          </Text>
          <Text style={styles.text}>
            After the three players every pack drops a bonus - the same amount as coins
            AND as level-up points: Session {PACK_TYPES.session.bonus[0]}-{PACK_TYPES.session.bonus[1]},
            Standard {PACK_TYPES.standard.bonus[0]}-{PACK_TYPES.standard.bonus[1]},
            Rare {PACK_TYPES.rare.bonus[0]}-{PACK_TYPES.rare.bonus[1]},
            Ultimate {PACK_TYPES.ultimate.bonus[0]}-{PACK_TYPES.ultimate.bonus[1]}.
            High amounts are rarer than low ones.
          </Text>
          <Text style={styles.text}>
            Duplicates are your choice: sell for coins or take the same value as
            level-up points (Bronze {SELL_VALUE.bronze} · Silver {SELL_VALUE.silber} ·
            Gold {SELL_VALUE.gold} · Legendary {SELL_VALUE.legendaer}).
          </Text>
        </Card>

        <SectionTitle>The ??? card</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Rarer than Legendary and drawable only ONCE ever: a 99-rated player. You name
            him and pick his position yourself. He always joins your club - even over the
            squad limit - and can never be sold.
          </Text>
        </Card>

        <SectionTitle>Level-up points</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Spend points on any player in his detail view (Squad tab). One level gives +1
            on every attribute. The cost depends on the player's current rating: up to
            59 → 25 points, 60-74 → 50, 75-85 → 100, 86-89 → 200, from 90 → 250.
            The maximum rating is 99.
          </Text>
        </Card>

        <SectionTitle>Squad</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Formations: 4-4-2, 4-3-3 and 4-2-4. Tap a slot to swap players, or use Best XI
            to fill the lineup automatically. Your squad holds at most{' '}
            {BALANCING.maxSquadSize} players - sell spare players in their detail view.
          </Text>
          <Text style={styles.text}>
            The captain (gold C badge) earns bonus coins: +{LEAGUE_REWARDS.captainGoal} per
            goal and +{LEAGUE_REWARDS.captainAssist} per assist in league matches.
          </Text>
        </Card>

        <SectionTitle>League</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Your club plays in a division of 8 teams, 14 rounds per season, one match
            every {matchMin} minutes. Pick a tactic before kickoff - it really matters:
            offensive creates far more chances but weakens your defense, defensive is
            the opposite. A win pays {LEAGUE_REWARDS.win} coins, a draw {LEAGUE_REWARDS.draw}.
          </Text>
          <Text style={styles.text}>
            At half-time the match pauses: make substitutions and change your tactic -
            both really affect the second half. A live possession bar (green = you)
            runs during the match.
          </Text>
          <Text style={styles.text}>
            After the last matchday the season review shows the final table, your
            promotion or relegation with the season prize, the Player of the Season
            and every player's average rating.
          </Text>
          <Text style={styles.text}>
            Red cards (or two yellows) suspend a player for the next match. At the end of
            a season the top two are promoted, the bottom two relegated - and 1st/2nd
            place win a prize that grows with the division (up to{' '}
            {LEAGUE_REWARDS.seasonByDivision[1][0]}/{LEAGUE_REWARDS.seasonByDivision[1][1]} coins
            in Division 1).
          </Text>
        </Card>

        <SectionTitle>Friendlies</SectionTitle>
        <Card>
          <Text style={styles.text}>
            Add friends with their 6-character code (Profile tab) and play friendlies
            against their latest synced XI - just for fun, no coins.
          </Text>
        </Card>

        <GKButton
          title="Back"
          variant="ghost"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: font.small,
    color: colors.ink,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  backBtn: {
    marginTop: spacing.md,
  },
});
