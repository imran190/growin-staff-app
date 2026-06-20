import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import GrowinTextInput from '../components/GrowinTextInput';
import GrowinButton from '../components/GrowinButton';
import { growinTheme, isIOS } from '../styles/growinTheme';
import { growinLogin } from '../services/growinApi';

export default function LoginScreen({ onLogin }) {
  const [agentCode, setAgentCode] = useState('10001');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      const result = await growinLogin({ agentCode, username, password });
      onLogin({
        companyName: result.agent.company_name || 'Growin CRM',
        agentCode,
        apiBaseUrl: result.agent.api_base_url,
        token: result.login.token || result.login.access_token || '',
        user: result.login.user || { name: username || 'Staff User' }
      });
    } catch (error) {
      Alert.alert('Login Issue', error.message || 'Login nahi ho paya.');
    } finally {
      setLoading(false);
    }
  }

  function openDemo() {
    onLogin({
      companyName: 'TravBizz CRM Demo',
      agentCode,
      apiBaseUrl: 'https://crm.travbizz.com/growin_app/growin_api.php',
      token: 'demo-token',
      user: { name: 'Staff User', role: 'Sales Team' },
      demo: true
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={isIOS ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <View style={styles.logoCard}>
              <Image source={require('../../assets/growin-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Staff CRM Login</Text>
            <Text style={styles.subTitle}>Agent code se CRM connect hoga, phir staff login chalega.</Text>
          </View>

          <View style={styles.card}>
            <GrowinTextInput
              label="Agent Code"
              value={agentCode}
              onChangeText={setAgentCode}
              keyboardType="number-pad"
              placeholder="5 digit agent code"
            />
            <GrowinTextInput
              label="Username / Email"
              value={username}
              onChangeText={setUsername}
              keyboardType="email-address"
              placeholder="staff username"
            />
            <GrowinTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="password"
            />
            <GrowinButton title="Sign In" loading={loading} onPress={handleLogin} />
            <GrowinButton title="Open Demo Dashboard" variant="secondary" onPress={openDemo} />
            <Text style={styles.note}>iPhone me iOS style aur Android me Material style follow hoga.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: growinTheme.colors.mint2 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 14 : 42,
    paddingBottom: 24,
    justifyContent: 'center'
  },
  hero: { alignItems: 'center', marginBottom: 24 },
  logoCard: {
    width: 116,
    height: 116,
    borderRadius: isIOS ? 32 : 24,
    backgroundColor: growinTheme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...growinTheme.shadow
  },
  logo: { width: 92, height: 46 },
  title: {
    fontSize: 28,
    color: growinTheme.colors.ink,
    fontWeight: isIOS ? '800' : '900',
    letterSpacing: -0.4
  },
  subTitle: {
    textAlign: 'center',
    color: growinTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 310
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    borderRadius: growinTheme.radius.card,
    padding: 18,
    ...growinTheme.shadow
  },
  note: {
    marginTop: 14,
    color: growinTheme.colors.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17
  }
});
