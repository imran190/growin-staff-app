import React, { useState } from 'react';
import {
  AppRegistry,
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
  View
} from 'react-native';

const MANAGER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';

const colors = {
  primary: '#10A766',
  primaryDark: '#057246',
  bg: '#F4FFF8',
  card: '#FFFFFF',
  ink: '#10231B',
  muted: '#6E8077',
  line: '#E1EEE7',
  danger: '#DD3B43',
  warning: '#F59F00',
  blue: '#2563EB'
};

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA9A2"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function Button({ title, onPress, secondary }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={({ pressed }) => [styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : styles.buttonTextPrimary]}>{title}</Text>
    </Pressable>
  );
}

function LoginScreen({ onDemo, onLogin }) {
  const [agentCode, setAgentCode] = useState('10001');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!/^\d{5}$/.test(String(agentCode).trim())) {
      Alert.alert('Agent Code', 'Agent code 5 digit ka hona chahiye.');
      return;
    }
    if (!username.trim() || !password) {
      Alert.alert('Login', 'Username aur password enter karo.');
      return;
    }
    try {
      setLoading(true);
      const resolveUrl = MANAGER_URL + '?agent_code=' + encodeURIComponent(agentCode.trim());
      const resolveResponse = await fetch(resolveUrl, { headers: { Accept: 'application/json' } });
      const agent = await resolveResponse.json();
      if (!resolveResponse.ok || !agent.status) throw new Error(agent.message || 'Agent code resolve nahi hua.');
      const apiBaseUrl = agent.api_base_url || String(agent.crm_url || '').replace(/\/+$/, '') + '/growin_app/growin_api.php';
      const loginResponse = await fetch(apiBaseUrl + '?endpoint=auth.login', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password, agent_code: agentCode.trim(), app_name: 'Growin Staff' })
      });
      const login = await loginResponse.json();
      if (!loginResponse.ok || !login.status) throw new Error(login.message || 'Login failed.');
      onLogin({ companyName: agent.company_name || 'Growin CRM', userName: (login.user && login.user.name) || username.trim(), apiBaseUrl });
    } catch (e) {
      Alert.alert('Login Issue', e.message || 'Login nahi ho paya.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.loginScroll}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>✈</Text>
          </View>
          <Text style={styles.brand}>Growin</Text>
          <Text style={styles.brandSub}>Staff Travel CRM</Text>
          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.welcomeSub}>Agent code se CRM connect hoga, phir staff login chalega.</Text>
          <View style={styles.loginCard}>
            <Field label="Agent Code" value={agentCode} onChangeText={setAgentCode} keyboardType="number-pad" placeholder="5 digit agent code" />
            <Field label="Username / Email" value={username} onChangeText={setUsername} keyboardType="email-address" placeholder="staff username" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="password" />
            <Button title={loading ? 'Checking...' : 'Sign In'} onPress={signIn} />
            <Button title="Open Demo Dashboard" secondary onPress={onDemo} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Dashboard({ session, onLogout }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView contentContainerStyle={styles.dashboardScroll}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.hello}>Hello, {session.userName}</Text>
            <Text style={styles.company}>{session.companyName}</Text>
          </View>
          <Pressable onPress={onLogout} style={styles.logoutBtn}><Text style={styles.logoutText}>Logout</Text></Pressable>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.cardTitle}>Today Overview</Text>
          <Text style={styles.cardSub}>Clean staff dashboard, no extra clutter.</Text>
          <View style={styles.grid}>
            <Stat label="New Queries" value="18" color={colors.primary} />
            <Stat label="Follow-ups" value="07" color={colors.warning} />
            <Stat label="Confirmed" value="05" color={colors.primaryDark} />
            <Stat label="Due Payments" value="₹82K" color={colors.blue} />
          </View>
        </View>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {['Add Query', 'Query List', 'Itinerary', 'WhatsApp'].map((item) => (
            <View key={item} style={styles.quickCard}><Text style={styles.quickText}>{item}</Text></View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Today Tasks</Text>
        <View style={styles.taskCard}>
          {['Call Rahul Sharma', 'Send Dubai quotation', 'Payment follow-up'].map((item, index) => (
            <View key={item} style={[styles.taskRow, index < 2 ? styles.taskBorder : null]}>
              <View style={styles.dot} />
              <View style={styles.flex}>
                <Text style={styles.taskTitle}>{item}</Text>
                <Text style={styles.taskMeta}>{index === 0 ? 'Goa query • 11:30 AM' : index === 1 ? 'Pending quotation' : 'Invoice #INV-104 • ₹18,500'}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function App() {
  const [session, setSession] = useState(null);
  if (!session) {
    return <LoginScreen onLogin={setSession} onDemo={() => setSession({ companyName: 'TravBizz CRM Demo', userName: 'Staff User' })} />;
  }
  return <Dashboard session={session} onLogout={() => setSession(null)} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  loginScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  logoCircle: { alignSelf: 'center', width: 92, height: 92, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#064b2d', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  logoIcon: { fontSize: 42, color: colors.primary },
  brand: { textAlign: 'center', fontSize: 38, fontWeight: '900', color: colors.ink, letterSpacing: -1 },
  brandSub: { textAlign: 'center', fontSize: 16, color: colors.primary, fontWeight: '800', marginTop: 2 },
  welcome: { textAlign: 'center', fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: 28 },
  welcomeSub: { textAlign: 'center', fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  loginCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 26, padding: 18, shadowColor: '#064b2d', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  fieldWrap: { marginBottom: 14 },
  label: { color: colors.muted, fontWeight: '800', marginBottom: 7, fontSize: 13 },
  input: { height: 52, borderRadius: Platform.OS === 'ios' ? 16 : 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingHorizontal: 15, fontSize: 16, color: colors.ink },
  button: { height: 52, borderRadius: Platform.OS === 'ios' ? 16 : 10, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: '#EAFBF2', borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.82 },
  buttonText: { fontSize: 16, fontWeight: '900' },
  buttonTextPrimary: { color: '#fff' },
  buttonTextSecondary: { color: colors.primaryDark },
  dashboardScroll: { padding: 18, paddingTop: Platform.OS === 'ios' ? 12 : 42, paddingBottom: 32 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  hello: { fontSize: 26, fontWeight: '900', color: colors.ink },
  company: { color: colors.muted, marginTop: 4, fontSize: 13 },
  logoutBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  logoutText: { color: colors.primaryDark, fontWeight: '800' },
  overviewCard: { backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: colors.line, padding: 17, shadowColor: '#064b2d', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardTitle: { fontSize: 19, fontWeight: '900', color: colors.ink },
  cardSub: { color: colors.muted, marginTop: 4, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, justifyContent: 'space-between' },
  statBox: { width: '48%', backgroundColor: colors.bg, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.muted, marginTop: 5, fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: colors.ink, marginTop: 22, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickCard: { width: '48%', height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickText: { color: colors.primaryDark, fontWeight: '900' },
  taskCard: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  taskBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 12 },
  taskTitle: { fontSize: 14, color: colors.ink, fontWeight: '900' },
  taskMeta: { color: colors.muted, fontSize: 12, marginTop: 3 }
});

AppRegistry.registerComponent('main', () => App);
export default App;
