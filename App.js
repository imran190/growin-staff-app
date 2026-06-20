import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const MANAGER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';
const SESSION_KEY = 'growin_staff_session_v2';

function money(v) {
  const n = Number(v || 0);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(n);
}
function number(v) {
  const n = Number(v || 0);
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function valueText(item) {
  return item?.format === 'money' || item?.key === 'sales' || item?.key === 'pending_payments'
    ? money(item?.value)
    : number(item?.value);
}
function apiUrl(session, endpoint, params = {}) {
  const q = new URLSearchParams({ endpoint, ...params }).toString();
  return `${session.apiBaseUrl}?${q}`;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [agentCode, setAgentCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadSession(); }, []);

  async function loadSession() {
    try {
      const saved = await SecureStore.getItemAsync(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.token && parsed?.apiBaseUrl) setSession(parsed);
      }
    } catch (e) {}
    setBooting(false);
  }

  async function handleSignIn() {
    if (!agentCode.trim() || !username.trim() || !password) {
      setMessage('Agent Code, Username aur Password required hai.');
      return;
    }
    setLoginLoading(true);
    setMessage('Agent code check ho raha hai...');
    try {
      const resolveRes = await fetch(`${MANAGER_URL}?agent_code=${encodeURIComponent(agentCode.trim())}`);
      const resolveData = await resolveRes.json();
      if (!resolveData?.status) throw new Error(resolveData?.message || 'Agent code invalid hai.');
      setMessage('CRM login ho raha hai...');
      const loginUrl = resolveData.login_endpoint || `${resolveData.api_base_url}?endpoint=auth.login`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: username.trim(), password, agent_code: agentCode.trim(), platform: Platform.OS })
      });
      const loginData = await loginRes.json();
      if (!loginData?.status) throw new Error(loginData?.message || 'Login failed.');
      const user = loginData?.data?.user || loginData?.user || {};
      const newSession = {
        token: loginData?.data?.token || loginData?.token || loginData?.access_token || 'logged_in',
        agentCode: agentCode.trim(),
        username: user.display_name || user.name || user.email || username.trim(),
        email: user.email || username.trim(),
        user,
        companyName: resolveData.company_name || 'Growin CRM',
        apiBaseUrl: resolveData.api_base_url,
        loginAt: new Date().toISOString()
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setPassword('');
      setMessage('');
    } catch (e) {
      const msg = e?.message || 'Login request failed.';
      setMessage(msg);
      Alert.alert('Login Error', msg);
    } finally {
      setLoginLoading(false);
    }
  }
  async function logout() {
    try { await SecureStore.deleteItemAsync(SESSION_KEY); } catch (e) {}
    setSession(null);
  }

  if (booting) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#0AA764" size="large" /><Text style={styles.muted}>Growin loading...</Text></View></SafeAreaView>;
  }
  if (session) return <MainApp session={session} onLogout={logout} />;
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Growin</Text>
          <Text style={styles.logoSub}>Travel CRM Staff App</Text>
          <Text style={styles.loginTitle}>Welcome Back</Text>
          <Text style={styles.loginSub}>Sign in to continue</Text>
          <Text style={styles.label}>Agent Code</Text>
          <TextInput style={styles.input} placeholder="Enter 5 digit agent code" placeholderTextColor="#8A96A8" value={agentCode} onChangeText={setAgentCode} keyboardType="number-pad" maxLength={5} />
          <Text style={styles.label}>Username / Email</Text>
          <TextInput style={styles.input} placeholder="Enter username or email" placeholderTextColor="#8A96A8" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passRow}>
            <TextInput style={styles.passInput} placeholder="Enter password" placeholderTextColor="#8A96A8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <Pressable style={styles.showBtn} onPress={() => setShowPassword(!showPassword)}><Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable>
          </View>
          {!!message && <Text style={styles.errorText}>{message}</Text>}
          <Pressable style={[styles.signBtn, loginLoading && { opacity: 0.65 }]} onPress={handleSignIn} disabled={loginLoading}>
            {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signText}>Sign In</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MainApp({ session, onLogout }) {
  const [tab, setTab] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true); setErr('');
    try {
      const res = await fetch(apiUrl(session, 'dashboard.full'), { headers: { Accept: 'application/json', Authorization: `Bearer ${session.token}` } });
      const json = await res.json();
      if (!json?.status) throw new Error(json?.message || 'Dashboard API failed');
      setDash(json.data || {});
    } catch (e) {
      setErr(e?.message || 'Unable to load dashboard');
    } finally { setLoading(false); }
  }

  const initial = (session.username || 'U').slice(0, 1).toUpperCase();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headSmall}>{session.companyName}</Text>
          <Text style={styles.headTitle}>{tab}</Text>
        </View>
        <Pressable style={styles.profileBtn} onPress={onLogout}><Text style={styles.profileText}>{initial}</Text></Pressable>
      </View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput style={styles.searchInput} placeholder="Search CRM" placeholderTextColor="#8A96A8" value={search} onChangeText={setSearch} />
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'Dashboard' ? <Dashboard dash={dash} loading={loading} error={err} reload={loadDashboard} /> : <ModuleScreen title={tab} session={session} />}
      </View>

      <View style={styles.footerNav}>
        {['Dashboard', 'Queries', 'Itinerary', 'Payments', 'More'].map((name) => (
          <Pressable key={name} style={styles.navItem} onPress={() => setTab(name)}>
            <Text style={[styles.navIcon, tab === name && styles.navActive]}>{navIcon(name)}</Text>
            <Text style={[styles.navText, tab === name && styles.navActive]}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
function navIcon(n) { return n === 'Dashboard' ? '⌂' : n === 'Queries' ? '◫' : n === 'Itinerary' ? '✈' : n === 'Payments' ? '₹' : '☰'; }

function Dashboard({ dash, loading, error, reload }) {
  const kpis = dash?.kpis || [];
  const trend = dash?.monthly_trend || [];
  const pipeline = dash?.pipeline || [];
  const modules = dash?.modules || [];
  const weather = dash?.weather || [];
  const recent = dash?.recent_queries || [];
  const maxTrend = Math.max(1, ...trend.map(x => Number(x.total || 0), Number(x.won || 0)));
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.dashboardWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#0AA764" />}>
      {error ? <View style={styles.errorCard}><Text style={styles.errorStrong}>Live dashboard API error</Text><Text style={styles.errorText}>{error}</Text></View> : null}
      {loading && !dash ? <View style={styles.centerBlock}><ActivityIndicator color="#0AA764" /><Text style={styles.muted}>Loading live CRM dashboard...</Text></View> : null}

      <View style={styles.kpiGrid}>
        {kpis.slice(0, 8).map((item) => <Kpi key={item.key || item.title} item={item} />)}
      </View>

      <Card title="Monthly Query Trend" right="Live">
        <View style={styles.chartArea}>
          {trend.map((m, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={styles.chartBars}>
                <View style={[styles.barTotal, { height: Math.max(4, (Number(m.total || 0) / maxTrend) * 96) }]} />
                <View style={[styles.barWon, { height: Math.max(4, (Number(m.won || 0) / maxTrend) * 96) }]} />
              </View>
              <Text style={styles.chartLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}><Text style={styles.legendTotal}>● Total</Text><Text style={styles.legendWon}>● Won</Text></View>
      </Card>

      <Card title="Destination Weather" right={weather.length ? 'CRM' : 'Off'}>
        <View style={styles.weatherRow}>
          {weather.length ? weather.slice(0, 3).map((w, i) => (
            <View key={i} style={styles.weatherCard}>
              <Text style={styles.weatherCity}>{w.name}</Text>
              <Text style={styles.weatherTemp}>{w.temperature !== null && w.temperature !== undefined ? `${w.temperature}°` : '--'}</Text>
              <Text style={styles.weatherCond}>{w.condition || 'Weather'}</Text>
            </View>
          )) : <Text style={styles.muted}>CRM weather widget off hai ya data available nahi hai.</Text>}
        </View>
      </Card>

      <Card title="Query Pipeline" right="Stage">
        {pipeline.length ? pipeline.slice(0, 6).map((p, i) => <Progress key={i} label={p.label} value={p.value} max={Math.max(...pipeline.map(x => Number(x.value || 0)), 1)} />) : <Text style={styles.muted}>No pipeline data</Text>}
      </Card>

      <Card title="All Sections" right="Modules">
        <View style={styles.moduleGrid}>{modules.map((m) => <View key={m.key} style={styles.moduleCard}><Text style={styles.moduleName}>{m.title}</Text><Text style={styles.moduleCount}>{m.key === 'payments' ? money(m.count) : number(m.count)}</Text></View>)}</View>
      </Card>

      <Card title="Recent Queries" right="Latest">
        {recent.length ? recent.map((q) => <View key={q.id} style={styles.queryRow}><View><Text style={styles.queryTitle}>{q.title}</Text><Text style={styles.queryMeta}>{q.destination || 'Destination'} • {q.status || 'Open'}</Text></View><Text style={styles.chev}>›</Text></View>) : <Text style={styles.muted}>No recent queries</Text>}
      </Card>
    </ScrollView>
  );
}
function Kpi({ item }) { return <View style={styles.kpiCard}><Text style={styles.kpiValue}>{valueText(item)}</Text><Text style={styles.kpiTitle}>{item.title}</Text><Text style={styles.kpiSub}>{item.sub}</Text></View>; }
function Card({ title, right, children }) { return <View style={styles.card}><View style={styles.cardHead}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardRight}>{right}</Text></View>{children}</View>; }
function Progress({ label, value, max }) { return <View style={styles.progressRow}><View style={styles.progressTop}><Text style={styles.progressLabel}>{label}</Text><Text style={styles.progressValue}>{number(value)}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (Number(value || 0) / max) * 100)}%` }]} /></View></View>; }
function ModuleScreen({ title }) { return <View style={styles.moduleScreen}><Text style={styles.moduleBig}>{title}</Text><Text style={styles.muted}>Is section ka native screen next connect hoga. Footer navigation ready hai.</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4FAF8' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, muted: { color: '#708093', fontWeight: '700', lineHeight: 20 },
  loginWrap: { flexGrow: 1, padding: 24, justifyContent: 'center' }, logo: { fontSize: 46, fontWeight: '900', color: '#053B46', textAlign: 'center' }, logoSub: { fontSize: 16, fontWeight: '700', color: '#0AA764', textAlign: 'center', marginBottom: 28 }, loginTitle: { fontSize: 30, fontWeight: '900', color: '#102033', textAlign: 'center' }, loginSub: { fontSize: 15, color: '#6B7688', textAlign: 'center', marginTop: 8, marginBottom: 30 }, label: { fontSize: 13, color: '#43536A', fontWeight: '800', marginBottom: 8, marginLeft: 4 }, input: { height: 58, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE7EA', paddingHorizontal: 18, fontSize: 16, marginBottom: 16, color: '#102033' }, passRow: { height: 58, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE7EA', paddingLeft: 18, paddingRight: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }, passInput: { flex: 1, fontSize: 16, color: '#102033', height: '100%' }, showBtn: { paddingHorizontal: 13, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F7F1' }, showText: { color: '#069957', fontWeight: '900', fontSize: 13 }, errorText: { color: '#B42318', fontSize: 14, fontWeight: '700', lineHeight: 20 }, signBtn: { height: 58, borderRadius: 17, backgroundColor: '#08A85A', alignItems: 'center', justifyContent: 'center', marginTop: 4 }, signText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  appHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 }, headSmall: { color: '#0AA764', fontWeight: '900', fontSize: 12 }, headTitle: { color: '#102033', fontWeight: '900', fontSize: 24, marginTop: 2 }, profileBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#053B46', alignItems: 'center', justifyContent: 'center' }, profileText: { color: '#fff', fontWeight: '900', fontSize: 18 }, searchBox: { height: 48, marginHorizontal: 18, marginBottom: 8, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE7EA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, searchIcon: { fontSize: 22, color: '#6B7688', marginRight: 8 }, searchInput: { flex: 1, fontSize: 16, color: '#102033' },
  dashboardWrap: { padding: 18, paddingBottom: 92 }, centerBlock: { padding: 30, alignItems: 'center' }, errorCard: { backgroundColor: '#FFF1F0', borderColor: '#FDA29B', borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 }, errorStrong: { color: '#B42318', fontWeight: '900', marginBottom: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, kpiCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#DDE7EA' }, kpiValue: { color: '#053B46', fontSize: 27, fontWeight: '900' }, kpiTitle: { color: '#102033', fontSize: 13, fontWeight: '900', marginTop: 8 }, kpiSub: { color: '#708093', fontSize: 12, fontWeight: '700', marginTop: 3 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#DDE7EA' }, cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, cardTitle: { fontSize: 18, fontWeight: '900', color: '#102033' }, cardRight: { color: '#0AA764', fontWeight: '900', fontSize: 12 },
  chartArea: { height: 130, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, chartCol: { flex: 1, alignItems: 'center' }, chartBars: { height: 104, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }, barTotal: { width: 13, borderRadius: 10, backgroundColor: '#053B46' }, barWon: { width: 13, borderRadius: 10, backgroundColor: '#0AA764' }, chartLabel: { color: '#708093', fontWeight: '800', fontSize: 12, marginTop: 8 }, legendRow: { flexDirection: 'row', gap: 18, marginTop: 8 }, legendTotal: { color: '#053B46', fontWeight: '800' }, legendWon: { color: '#0AA764', fontWeight: '800' },
  weatherRow: { flexDirection: 'row', gap: 10 }, weatherCard: { flex: 1, backgroundColor: '#F4FAF8', borderRadius: 16, padding: 12, minHeight: 96 }, weatherCity: { color: '#102033', fontWeight: '900', fontSize: 13 }, weatherTemp: { color: '#053B46', fontWeight: '900', fontSize: 28, marginTop: 8 }, weatherCond: { color: '#708093', fontWeight: '700', fontSize: 11, marginTop: 2 },
  progressRow: { marginBottom: 13 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between' }, progressLabel: { color: '#102033', fontWeight: '800' }, progressValue: { color: '#053B46', fontWeight: '900' }, progressTrack: { height: 9, borderRadius: 9, backgroundColor: '#EAF1F3', marginTop: 8, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#0AA764', borderRadius: 9 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, moduleCard: { width: '31%', backgroundColor: '#F4FAF8', borderRadius: 16, padding: 10, minHeight: 70, justifyContent: 'center' }, moduleName: { color: '#102033', fontWeight: '900', fontSize: 12 }, moduleCount: { color: '#0AA764', fontWeight: '900', fontSize: 15, marginTop: 5 },
  queryRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3F5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, queryTitle: { color: '#102033', fontSize: 15, fontWeight: '900' }, queryMeta: { color: '#708093', marginTop: 4, fontWeight: '700', fontSize: 12 }, chev: { color: '#0AA764', fontSize: 28 },
  footerNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#DDE7EA', flexDirection: 'row', paddingTop: 8 }, navItem: { flex: 1, alignItems: 'center' }, navIcon: { color: '#708093', fontSize: 22, fontWeight: '900' }, navText: { color: '#708093', fontSize: 11, fontWeight: '900', marginTop: 3 }, navActive: { color: '#0AA764' },
  moduleScreen: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }, moduleBig: { fontSize: 26, fontWeight: '900', color: '#102033', marginBottom: 8 }
});
