import React from 'react';
import { Platform, Text, TextInput, View, StyleSheet } from 'react-native';
import { growinTheme } from '../styles/growinTheme';

export default function GrowinTextInput({ label, value, onChangeText, secureTextEntry, keyboardType, placeholder }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#99A9A1"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    color: growinTheme.colors.muted,
    marginBottom: 7,
    fontWeight: Platform.OS === 'ios' ? '600' : '700'
  },
  input: {
    height: Platform.OS === 'ios' ? 52 : 50,
    backgroundColor: growinTheme.colors.white,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    borderRadius: growinTheme.radius.input,
    paddingHorizontal: 15,
    fontSize: 16,
    color: growinTheme.colors.ink
  }
});
