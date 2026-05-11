import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Signal, Wifi, BatteryFull } from 'lucide-react-native';
import { colors, fonts } from '../theme';

export function AppStatusBar() {
  return (
    <View style={styles.container}>
      <Text style={styles.time}>9:41</Text>
      <View style={styles.right}>
        <Signal size={14} color={colors.textPrimary} />
        <Wifi size={14} color={colors.textPrimary} />
        <BatteryFull size={14} color={colors.textPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  time: {
    fontFamily: fonts.inter.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
