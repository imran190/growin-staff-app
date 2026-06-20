import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { growinTheme } from '../styles/growinTheme';

export default function PlaceholderScreen({ title }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>Ye section next update me page-by-page banega.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: growinTheme.colors.mint2, padding: 18, justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: growinTheme.radius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    alignItems: 'center'
  },
  title: { fontSize: 24, fontWeight: '900', color: growinTheme.colors.ink },
  text: { marginTop: 8, color: growinTheme.colors.muted, textAlign: 'center' }
});
