import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const MANAGER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';

function cleanCrmUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return { status: false, message: text || 'Invalid server response' };
  }
}

async function resolveAgent(agentCode) {
  const url = `${MANAGER_URL}?agent_code=${encodeURIComponent(agentCode)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await parseJson(response);

  if (!response.ok || data.status === false) {
    throw new Error(data.message || 'Agent code not found');
  }

  const crmUrl = cleanCrmUrl(data.crm_url);
  const apiBaseUrl = data.api_base_url || `${crmUrl}/growin_app/growin_api.php`;

  if (!apiBaseUrl) {
    throw new Error('CRM API URL not found for this agent code');
  }

  return {
    agentCode,
    companyName: data.company_name || 'Growin CRM',
    crmUrl,
    apiBaseUrl,
    loginEndpoint: data.login_endpoint || `${apiBaseUrl}?endpoint=auth.login`,
  };
}

async function loginToCrm(agent, username, password) {
  const response = await fetch(agent.loginEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_code: agent.agentCode,
      username,
      email: username,
      password,
      platform: Platform.OS,
      app: 'growin_staff',
    }),
  });

  const data = await parseJson(response);

  if (!response.ok || data.status === false) {
    throw new Error(data.message || 'Login failed. Username/password check karo.');
  }

  return data;
}

function DashboardScreen({ session, onLogout }) {
  const displayName =
    session?.user?.name ||
    session?.name ||
    session?.user_name ||
    session?.username ||
    'Staff User';

  const companyName = session?.agent?.companyName || session?.company_name || 'Growin CRM';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.dashboardWrap}>
        <View style={styles.dashboardTop}>
          <View>
            <Text style={styles.mutedText}>Welcome</Text>
            <Text style={styles.dashboardTitle}>{displayName}</Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>Organization Dashboard</Text>
          <Text style={styles.heroText}>{companyName}</Text>
          <Text style={styles.heroSub}>Login successful. Dashboard API next step me connect karenge.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [agentCode, setAgentCode] = useState('10001');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);

  const isFormReady = useMemo(() => {
    return agentCode.trim().length === 5 && username.trim().length > 0 && password.length > 0;
  }, [agentCode, username, password]);

  const handleSignIn = async () => {
    if (loading) return;

    setMessage('');

    if (!isFormReady) {
      setMessage('Agent Code 5 digit, Username aur Password required hai.');
      return;
    }

    setLoading(true);
    setMessage('Agent code verify ho raha hai...');

    try {
      const agent = await resolveAgent(agentCode.trim());
      setMessage('CRM login check ho raha hai...');
      const loginData = await loginToCrm(agent, username.trim(), password);
      setMessage('');
      setSession({ ...loginData, agent, username: username.trim() });
    } catch (error) {
      setMessage(error?.message || 'Login nahi ho paya. CRM API check karo.');
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return <DashboardScreen session={session} onLogout={() => setSession(null)} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.loginWrap}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Growin</Text>
            <Text style={styles.brandSub}>Travel CRM Staff App</Text>
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Agent Code</Text>
            <TextInput
              value={agentCode}
              onChangeText={(text) => setAgentCode(text.replace(/[^0-9]/g, '').slice(0, 5))}
              style={styles.input}
              placeholder="5 digit agent code"
              placeholderTextColor="#8A96A8"
              keyboardType="number-pad"
              maxLength={5}
              editable={!loading}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Username / Email</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder="Username / Email"
              placeholderTextColor="#8A96A8"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordBox}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#8A96A8"
                secureTextEntry={!showPassword}
                editable={!loading}
                onSubmitEditing={handleSignIn}
              />
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                style={styles.showButton}
                hitSlop={12}
              >
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          {message ? (
            <Text style={[styles.message, loading && styles.infoMessage]}>{message}</Text>
          ) : null}

          <Pressable
            onPress={handleSignIn}
            style={({ pressed }) => [styles.signButton, pressed && styles.signButtonPressed]}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signButtonText}>Sign In</Text>}
          </Pressable>

          <Text style={styles.footerText}>Secured by Growin App Manager</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: '#F4FAF8',
  },
  loginWrap: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brand: {
    fontSize: 44,
    fontWeight: '900',
    color: '#053B46',
    letterSpacing: -1,
  },
  brandSub: {
    marginTop: 5,
    color: '#08A85A',
    fontSize: 17,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#12243A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    fontSize: 16,
    color: '#7A8797',
    textAlign: 'center',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    marginLeft: 4,
    color: '#2F3B4D',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7EA',
    color: '#12243A',
    fontSize: 17,
  },
  passwordBox: {
    height: 60,
    borderRadius: 18,
    paddingLeft: 20,
    paddingRight: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7EA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    color: '#12243A',
    fontSize: 17,
    paddingRight: 8,
  },
  showButton: {
    height: 48,
    minWidth: 70,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8FFF3',
  },
  showText: {
    color: '#08A85A',
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    color: '#D92D20',
    backgroundColor: '#FFF2F0',
    borderWidth: 1,
    borderColor: '#FFD1CB',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 14,
  },
  infoMessage: {
    color: '#075985',
    backgroundColor: '#EAF6FF',
    borderColor: '#BAE6FD',
  },
  signButton: {
    height: 60,
    borderRadius: 18,
    backgroundColor: '#08A85A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#08A85A',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  signButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.88,
  },
  signButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  footerText: {
    marginTop: 22,
    color: '#7A8797',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  dashboardWrap: {
    padding: 22,
    paddingBottom: 42,
  },
  dashboardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  mutedText: {
    color: '#7A8797',
    fontSize: 13,
    fontWeight: '800',
  },
  dashboardTitle: {
    color: '#12243A',
    fontSize: 28,
    fontWeight: '900',
  },
  logoutButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7EA',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#053B46',
    fontSize: 14,
    fontWeight: '900',
  },
  dashboardHero: {
    backgroundColor: '#053B46',
    borderRadius: 24,
    padding: 22,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },
  heroText: {
    color: '#BFF3D7',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  heroSub: {
    color: '#FFFFFF',
    opacity: 0.82,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
});
