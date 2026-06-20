import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { growinTheme, isIOS } from '../styles/growinTheme';

const tabs = [
  { key: 'dashboard', label: 'Home', icon: '⌂' },
  { key: 'queries', label: 'Query', icon: '▤' },
  { key: 'whatsapp', label: 'Chat', icon: '◉' },
  { key: 'settings', label: 'More', icon: '☰' }
];

export default function BottomTabs({ active = 'dashboard', onChange }) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onChange?.(tab.key)} style={styles.item}>
            <Text style={[styles.icon, selected && styles.active]}>{tab.icon}</Text>
            <Text style={[styles.label, selected && styles.active]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 22 : 14,
    height: 66,
    borderRadius: isIOS ? 28 : 18,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...growinTheme.shadow
  },
  item: { alignItems: 'center', justifyContent: 'center', minWidth: 62 },
  icon: { color: growinTheme.colors.muted, fontSize: 20, lineHeight: 24 },
  label: { color: growinTheme.colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  active: { color: growinTheme.colors.primaryDark }
});
