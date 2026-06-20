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
const SESSION_KEY = 'growin_staff_session_v1';

const defaultDashboard = {
  staff_name: 'Staff User',
  company_name: 'Growin CRM',
  today_followups: 8,
  new_queries: 14,
  confirmed_queries: 6,
  pending_payments: 12,
  itinerary_count: 27,
  company_count: 42,
  whatsapp_unread: 5,
  email_unread: 9,
  users_count: 11,
  total_sales: 485000,
  graph: [
    { label: 'Mon', value: 22 },
    { label: 'Tue', value: 34 },
    { label: 'Wed', value: 28 },
    { label: 'Thu', value: 46 },
    { label: 'Fri', value: 38 },
    { label: 'Sat', value: 31 },
    { label: 'Sun', value: 44 }
  ],
  recent_queries: [
    { id: 'Q-1021', name: 'Dubai Family Tour', stage: 'Follow-up', value: '₹1.85L' },
    { id: 'Q-1020', name: 'Manali Honeymoon', stage: 'Quotation', value: '₹72K' },
    { id: 'Q-1019', name: 'Bali Package', stage: 'Confirmed', value: '₹2.45L' }
  ]
};

export default function App() {
  const [agentCode, setAgentCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const saved = await SecureStore.getItemAsync(SESSION_KEY);
      if (!saved) {
        setBooting(false);
        return;
      }

      const parsed = JSON.parse(saved);
      if (!parsed?.token || !parsed?.apiBaseUrl) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setBooting(false);
        return;
      }

      setSession(parsed);
      setMessage('');
      setBooting(false);
      fetchDashboard(parsed, false);
    } catch (error) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setBooting(false);
    }
  }

  function getTokenFromLogin(loginData) {
    return (
      loginData?.token ||
      loginData?.auth_token ||
      loginData?.access_token ||
      loginData?.data?.token ||
      loginData?.data?.auth_token ||
      loginData?.user?.token ||
      ''
    );
  }

  function getUserFromLogin(loginData) {
    return loginData?.user || loginData?.staff || loginData?.data?.user || loginData?.data?.staff || {};
  }

  async function handleSignIn() {
    if (!agentCode.trim() || !username.trim() || !password) {
      setMessage('Agent Code, Username aur Password sab required hai.');
      return;
    }

    setLoading(true);
    setMessage('Agent code check ho raha hai...');

    try {
      const resolveUrl = `${MANAGER_URL}?agent_code=${encodeURIComponent(agentCode.trim())}`;
      const resolveRes = await fetch(resolveUrl);
      const resolveData = await resolveRes.json();

      if (!resolveData || resolveData.status !== true) {
        throw new Error(resolveData?.message || 'Agent code invalid hai.');
      }

      setMessage('CRM login ho raha hai...');

      const apiBaseUrl = resolveData.api_base_url;
      const loginUrl = resolveData.login_endpoint || `${apiBaseUrl}?endpoint=auth.login`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: username.trim(),
          password,
          agent_code: agentCode.trim(),
          device_type: Platform.OS
        })
      });

      const loginData = await loginRes.json();

      if (!loginData || loginData.status !== true) {
        throw new Error(loginData?.message || 'Login failed. CRM credentials check karo.');
      }

      const token = getTokenFromLogin(loginData);
      if (!token) {
        throw new Error('Login successful hai, lekin API token response me nahi mila. CRM API token field add karni padegi.');
      }

      const user = getUserFromLogin(loginData);
      const nextSession = {
        agentCode: agentCode.trim(),
        apiBaseUrl,
        crmUrl: resolveData.crm_url || '',
        companyName: resolveData.company_name || user.company_name || 'Growin CRM',
        token,
        user,
        loginAt: new Date().toISOString()
      };

      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setPassword('');
      setMessage('');
      fetchDashboard(nextSession, false);
    } catch (error) {
      const errorMessage = error?.message || 'Login request failed.';
      setMessage(errorMessage);
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setDashboard(defaultDashboard);
    setAgentCode('');
    setUsername('');
    setPassword('');
    setMessage('');
  }

  async function fetchDashboard(activeSession = session, showLoader = true) {
    if (!activeSession?.apiBaseUrl || !activeSession?.token) return;

    if (showLoader) setRefreshing(true);

    try {
      const dashboardUrl = `${activeSession.apiBaseUrl}?endpoint=dashboard.summary`;
      const response = await fetch(dashboardUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${activeSession.token}`,
          'X-Growin-Token': activeSession.token
        }
      });

      const data = await response.json();

      if (data?.status === false && (data?.code === 401 || data?.message?.toLowerCase?.().includes('inactive'))) {
        Alert.alert('Session Expired', 'Account inactive ya token expired hai. Dobara login karo.');
        logout();
        return;
      }

      const payload = data?.data || data?.dashboard || data;
      if (data?.status === true && payload) {
        setDashboard({
          ...defaultDashboard,
          ...payload,
          company_name: payload.company_name || activeSession.companyName || defaultDashboard.company_name,
          staff_name:
            payload.staff_name ||
            activeSession.user?.name ||
            activeSession.user?.firstName ||
            activeSession.user?.email ||
            defaultDashboard.staff_name,
          graph: Array.isArray(payload.graph) && payload.graph.length ? payload.graph : defaultDashboard.graph,
          recent_queries:
            Array.isArray(payload.recent_queries) && payload.recent_queries.length
              ? payload.recent_queries
              : defaultDashboard.recent_queries
        });
      }
    } catch (error) {
      // API ready na ho to app dashboard fallback data ke saath open rahega.
    } finally {
      setRefreshing(false);
    }
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#08A85A" />
          <Text style={styles.bootText}>Growin loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <DashboardScreen
        dashboard={dashboard}
        session={session}
        refreshing={refreshing}
        onRefresh={() => fetchDashboard(session, true)}
        onLogout={logout}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Text style={styles.logo}>Growin</Text>
            <Text style={styles.subLogo}>Travel CRM Staff App</Text>
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <Text style={styles.fieldLabel}>Agent Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 5 digit agent code"
            placeholderTextColor="#8A96A8"
            value={agentCode}
            onChangeText={setAgentCode}
            keyboardType="number-pad"
            maxLength={5}
          />

          <Text style={styles.fieldLabel}>Username / Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username or email"
            placeholderTextColor="#8A96A8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter password"
              placeholderTextColor="#8A96A8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable style={styles.showButton} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DashboardScreen({ dashboard, session, refreshing, onRefresh, onLogout }) {
  const graphMax = useMemo(() => {
    const values = (dashboard.graph || []).map((item) => Number(item.value || item.count || 0));
    return Math.max(...values, 1);
  }, [dashboard.graph]);

  const sectionItems = [
    { title: 'Queries', value: dashboard.new_queries, icon: 'Q' },
    { title: 'Itinerary', value: dashboard.itinerary_count, icon: 'I' },
    { title: 'Payments', value: dashboard.pending_payments, icon: '₹' },
    { title: 'Companies', value: dashboard.company_count, icon: 'C' },
    { title: 'WhatsApp', value: dashboard.whatsapp_unread, icon: 'W' },
    { title: 'Email', value: dashboard.email_unread, icon: 'E' },
    { title: 'Users', value: dashboard.users_count, icon: 'U' },
    { title: 'Org / Theme', value: 'Open', icon: 'O' }
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.dashboardScroll}
        contentContainerStyle={styles.dashboardContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#08A85A" />}
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.hello}>Hello, {dashboard.staff_name}</Text>
            <Text style={styles.company}>{dashboard.company_name || session.companyName}</Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard label="Today Follow-ups" value={dashboard.today_followups} />
          <KpiCard label="New Queries" value={dashboard.new_queries} />
          <KpiCard label="Confirmed" value={dashboard.confirmed_queries} />
          <KpiCard label="Pending Payments" value={dashboard.pending_payments} />
        </View>

        <View style={styles.salesCard}>
          <View style={styles.cardHeadRow}>
            <View>
              <Text style={styles.sectionTitle}>Sales Overview</Text>
              <Text style={styles.sectionSub}>This week performance</Text>
            </View>
            <Text style={styles.salesValue}>₹{formatCompact(dashboard.total_sales)}</Text>
          </View>

          <View style={styles.barChart}>
            {(dashboard.graph || []).map((item, index) => {
              const value = Number(item.value || item.count || 0);
              const height = Math.max(18, Math.round((value / graphMax) * 110));
              return (
                <View style={styles.barItem} key={`${item.label}-${index}`}>
                  <View style={[styles.bar, { height }]} />
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Sections</Text>
        <View style={styles.sectionGrid}>
          {sectionItems.map((item) => (
            <Pressable key={item.title} style={styles.moduleCard}>
              <View style={styles.moduleIcon}>
                <Text style={styles.moduleIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.moduleTitle}>{item.title}</Text>
              <Text style={styles.moduleValue}>{String(item.value ?? 0)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.recentCard}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.sectionTitle}>Recent Queries</Text>
            <Text style={styles.viewAll}>View all</Text>
          </View>
          {(dashboard.recent_queries || []).map((item, index) => (
            <View style={styles.queryRow} key={`${item.id}-${index}`}>
              <View style={styles.queryAvatar}>
                <Text style={styles.queryAvatarText}>{index + 1}</Text>
              </View>
              <View style={styles.queryInfo}>
                <Text style={styles.queryName}>{item.name || item.title || 'Query'}</Text>
                <Text style={styles.queryMeta}>{item.id || item.query_id} • {item.stage || 'Open'}</Text>
              </View>
              <Text style={styles.queryValue}>{item.value || item.amount || ''}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{String(value ?? 0)}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function formatCompact(value) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return `${amount}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#F4FAF8' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bootText: { marginTop: 12, color: '#546274', fontWeight: '700' },
  loginContainer: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoBox: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 46, fontWeight: '900', color: '#053B46', letterSpacing: -1 },
  subLogo: { fontSize: 17, color: '#0BA866', marginTop: 4, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '900', color: '#102033', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7688', textAlign: 'center', marginTop: 8, marginBottom: 30 },
  fieldLabel: { fontSize: 13, color: '#43536A', fontWeight: '800', marginBottom: 8, marginLeft: 4 },
  input: {
    height: 58,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA',
    paddingHorizontal: 18,
    fontSize: 16,
    marginBottom: 16,
    color: '#102033'
  },
  passwordRow: {
    height: 58,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA',
    paddingLeft: 18,
    paddingRight: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  passwordInput: { flex: 1, fontSize: 16, color: '#102033', height: '100%' },
  showButton: {
    paddingHorizontal: 13,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F7F1'
  },
  showButtonText: { color: '#069957', fontWeight: '900', fontSize: 13 },
  message: { color: '#B42318', fontSize: 14, lineHeight: 20, marginBottom: 14, marginLeft: 4, fontWeight: '600' },
  button: {
    height: 58,
    borderRadius: 17,
    backgroundColor: '#08A85A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  dashboardScroll: { flex: 1 },
  dashboardContainer: { padding: 18, paddingBottom: 32 },
  headerCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: '#083C47',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  hello: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  company: { color: '#B9EBD8', fontSize: 13, fontWeight: '700', marginTop: 5 },
  logoutButton: { backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 13 },
  logoutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard: {
    width: '48%',
    borderRadius: 22,
    padding: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA'
  },
  kpiValue: { color: '#102033', fontSize: 28, fontWeight: '900' },
  kpiLabel: { color: '#6B7688', fontSize: 13, lineHeight: 18, marginTop: 5, fontWeight: '700' },
  salesCard: { borderRadius: 24, padding: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7EA', marginBottom: 18 },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#102033', fontSize: 19, fontWeight: '900', marginBottom: 4 },
  sectionSub: { color: '#7A8798', fontSize: 13, fontWeight: '700' },
  salesValue: { color: '#08A85A', fontSize: 20, fontWeight: '900' },
  barChart: { height: 158, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
  barItem: { alignItems: 'center', width: 36 },
  bar: { width: 22, borderRadius: 11, backgroundColor: '#08A85A' },
  barLabel: { marginTop: 8, color: '#7A8798', fontSize: 11, fontWeight: '800' },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, marginBottom: 18 },
  moduleCard: {
    width: '48%',
    borderRadius: 22,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7EA'
  },
  moduleIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#E9F7F1', alignItems: 'center', justifyContent: 'center' },
  moduleIconText: { color: '#08A85A', fontWeight: '900', fontSize: 16 },
  moduleTitle: { color: '#102033', fontSize: 15, fontWeight: '900', marginTop: 12 },
  moduleValue: { color: '#6B7688', fontSize: 13, fontWeight: '800', marginTop: 4 },
  recentCard: { borderRadius: 24, padding: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7EA' },
  viewAll: { color: '#08A85A', fontWeight: '900', fontSize: 13 },
  queryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF3F4' },
  queryAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#F0F5F6', alignItems: 'center', justifyContent: 'center' },
  queryAvatarText: { color: '#083C47', fontWeight: '900' },
  queryInfo: { flex: 1, marginLeft: 12 },
  queryName: { color: '#102033', fontSize: 14, fontWeight: '900' },
  queryMeta: { color: '#7A8798', fontSize: 12, fontWeight: '700', marginTop: 3 },
  queryValue: { color: '#08A85A', fontSize: 13, fontWeight: '900' }
});
