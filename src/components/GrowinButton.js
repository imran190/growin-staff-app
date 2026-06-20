import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, StyleSheet } from 'react-native';
import { growinTheme } from '../styles/growinTheme';

export default function GrowinButton({ title, onPress, loading, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        pressed && Platform.OS === 'ios' ? { opacity: 0.82 } : null
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : growinTheme.colors.primary} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: growinTheme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  primary: { backgroundColor: growinTheme.colors.primary },
  secondary: { backgroundColor: growinTheme.colors.mint, borderWidth: 1, borderColor: growinTheme.colors.line },
  text: { fontSize: 16, fontWeight: Platform.OS === 'ios' ? '700' : '800' },
  primaryText: { color: '#fff' },
  secondaryText: { color: growinTheme.colors.primaryDark }
});
