import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

function normalizeCrmUrl(url) {
  if (!url) return '';
  return String(url).trim().replace(/\/+$/, '');
}

async function readJsonResponse(response) {
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
  const data = await readJsonResponse(response);

  if (!response.ok || data.status === false) {
    throw new Error(data.message || 'Agent code not found');
  }

  const apiBaseUrl = data.api_base_url || `${normalizeCrmUrl(data.crm_url)}/growin_app/growin_api.php`;
  if (!apiBaseUrl) {
    throw new Error('CRM API URL not found for this agent code');
  }

  return {
    agentCode,
    companyName: data.company_name || 'Growin CRM',
    crmUrl: data.crm_url || '',
    apiBaseUrl,
    loginEndpoint: data.login_endpoint || `${apiBaseUrl}?endpoint=auth.login`,
  };
}

async function loginToCrm(agentInfo, username, password) {
  const response = await fetch(agentInfo.loginEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_code: agentInfo.agentCode,
      username,
      email: username,
      password,
      platform: Platform.OS,
      app: 'growin_staff',
    }),
  });

  const data = await readJsonResponse(response);
  if (!response.ok || data.status === false) {
    throw new Error(data.message || 'Login failed. Please check username/password.');
  }
  return data;
}

function StatCard({ label, value, note }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function DashboardScreen({ session, onLogout }) {
  const displayName = session?.user?.name || session?.user_name || session?.username || 'Staff User';
  const companyName = session?.agent?.companyName || session?.company_name || 'Growin CRM';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.dashboardWrap}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.smallText}>Welcome</Text>
            <Text style={styles.dashboardTitle}>{displayName}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Organization Dashboard</Text>
          <Text style={styles.heroText}>{companyName}</Text>
          <Text style={styles.heroDate}>Today overview</Text>
        </View>

        <View style={styles.grid}>
          <StatCard label="Total Queries" value="--" note="CRM API connect next" />
          <StatCard label="Confirmed" value="--" note="Selected period" />
          <StatCard label="Payments" value="--" note="Pending / received" />
          <StatCard label="Follow-ups" value="--" note="Today tasks" />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Next Module</Text>
          <Text style={styles.infoText}>Query list, query detail and staff dashboard cards will be connected screen by screen.</Text>
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
  const [errorMessage, setErrorMessage] = useState('');
  const [session, setSession] = useState(null);

  const canSubmit = useMemo(() => {
    return agentCode.trim().length >= 5 && username.trim().length > 0 && password.length > 0 && !loading;
  }, [agentCode, username, password, loading]);

  const handleLogin = async () => {
    if (!canSubmit) {
      setErrorMessage('Agent code, username aur password required hai.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const agentInfo = await resolveAgent(agentCode.trim());
      const loginData = await loginToCrm(agentInfo, username.trim(), password);
      setSession({ ...loginData, agent: agentInfo, username: username.trim() });
    } catch (error) {
      setErrorMessage(error.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  const openDemo = () => {
    setSession({
      status: true,
      username: 'Demo Staff',
      agent: {
        agentCode: agentCode || '10001',
        companyName: 'Growin Demo CRM',
      },
    });
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
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>G</Text>
            </View>
            <Text style={styles.brand}>Growin</Text>
            <Text style={styles.brandSub}>Travel CRM Staff App</Text>
          </View>

          <View style={styles.cardMain}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in with your staff account</Text>

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
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Username / Email</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                placeholder="Enter username or email"
                placeholderTextColor="#8A96A8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#8A96A8"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </Pressable>

            <Pressable style={styles.demoBtn} onPress={openDemo}>
              <Text style={styles.demoText}>Open Demo Dashboard</Text>
            </Pressable>
          </View>

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
    padding: 22,
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#E8FFF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFF3D7',
  },
  brandMarkText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#08A85A',
  },
  brand: {
    fontSize: 42,
    fontWeight: '900',
    color: '#053B46',
    letterSpacing: -1,
  },
  brandSub: {
    fontSize: 16,
    color: '#0BA866',
    marginTop: 3,
    fontWeight: '700',
  },
  cardMain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#DDE7EA',
    shadowColor: '#053B46',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#102033',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7688',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#26384E',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FDFEFE',
    borderWidth: 1,
    borderColor: '#DDE7EA',
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#102033',
  },
  passwordRow: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FDFEFE',
    borderWidth: 1,
    borderColor: '#DDE7EA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#102033',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: {
    color: '#08A85A',
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    color: '#D92D20',
    backgroundColor: '#FFF2F0',
    borderColor: '#FFD1CB',
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    height: 56,
    borderRadius: 17,
    backgroundColor: '#08A85A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9BDDBD',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  demoBtn: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  demoText: {
    color: '#053B46',
    fontWeight: '800',
  },
  footerText: {
    textAlign: 'center',
    color: '#7A8797',
    fontSize: 12,
    marginTop: 18,
  },
  dashboardWrap: {
    padding: 18,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  smallText: {
    color: '#6B7688',
    fontSize: 13,
    fontWeight: '700',
  },
  dashboardTitle: {
    color: '#102033',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#053B46',
    fontWeight: '900',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#053B46',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: '#BFF3D7',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '700',
  },
  heroDate: {
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 14,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDE7EA',
  },
  statLabel: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    color: '#102033',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  statNote: {
    color: '#08A85A',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  infoCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA',
  },
  infoTitle: {
    color: '#102033',
    fontSize: 18,
    fontWeight: '900',
  },
  infoText: {
    color: '#6B7688',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
