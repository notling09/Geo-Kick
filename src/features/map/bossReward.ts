import { Alert } from 'react-native';
import { PITCH_BATTLE } from '../../core/domain/constants';
import { t, tf } from '../../core/i18n';
import { useBattleStore } from '../../state/battleStore';

/**
 * Boss-Belohnung wählen (V7): Nach einem Sieg gegen das Boss-Team des
 * Gold-Platzes entscheidet der Nutzer zwischen Coins+Punkten und 2 Session-
 * Packs. Wird sowohl nach einem 90-Minuten-Sieg (Live-Ticker) als auch nach
 * dem Elfmeterschießen aufgerufen.
 */
export function promptBossReward(onDone?: (text: string) => void): void {
  Alert.alert(
    t('bossRewardTitle'),
    t('bossRewardChoose'),
    [
      {
        text: tf('bossRewardCoins', { n: PITCH_BATTLE.bossWinReward }),
        onPress: () => {
          void useBattleStore.getState().claimBossReward('coins').then((text) => onDone?.(text));
        },
      },
      {
        text: t('bossRewardPacks'),
        onPress: () => {
          void useBattleStore.getState().claimBossReward('packs').then((text) => onDone?.(text));
        },
      },
    ],
    { cancelable: false },
  );
}
