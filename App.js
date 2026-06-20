import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';

const MANAGER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';
const SESSION_KEY = 'growin_staff_session_v3';

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeApiBase(resolveData) {
  const loginEndpoint = resolveData?.login_endpoint || '';
  if (loginEndpoint) return String(loginEndpoint).split('?')[0];

  const apiBase = resolveData?.api_base_url || resolveData?.api_url || resolveData?.growin_api_url || '';
  if (apiBase) return String(apiBase).split('?')[0];

  const crmUrl = resolveData?.crm_url || resolveData?.crm_base_url || '';
  if (crmUrl) return `${trimSlash(crmUrl)}/growin_app/growin_api.php`;

  return 'https://crm.travbizz.com/growin_app/growin_api.php';
}

function buildApiUrl(session, endpoint, params = {}) {
  const token = session?.token || '';
  const allParams = {
    endpoint,
    ...params,
    token,
    auth_token: token,
    session_token: token,
    access_token: token,
    staff_token: token,
    growin_token: token,
  };

  const query = Object.keys(allParams)
    .filter((key) => allParams[key] !== undefined && allParams[key] !== null && allParams[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(allParams[key]))}`)
    .join('&');

  const separator = String(session.apiBaseUrl).includes('?') ? '&' : '?';
  return `${session.apiBaseUrl}${separator}${query}`;
}

function apiHeaders(session) {
  const token = session?.token || '';
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Token: token,
    token,
    'Auth-Token': token,
    'X-Auth-Token': token,
    'X-Growin-Token': token,
    'X-Access-Token': token,
  };
}

async function readJson(res) {
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(text ? text.slice(0, 180) : 'Invalid JSON response');
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return json;
}

async function apiGet(session, endpoint, params = {}) {
  const res = await fetch(buildApiUrl(session, endpoint, params), {
    method: 'GET',
    headers: apiHeaders(session),
  });
  const json = await readJson(res);
  if (json?.status === false || json?.success === false) {
    throw new Error(json?.message || json?.error || 'API request failed');
  }
  return json?.data || json?.payload || json?.result || json?.dashboard || json || {};
}

function getToken(loginData) {
  return (
    loginData?.data?.token ||
    loginData?.data?.access_token ||
    loginData?.data?.session_token ||
    loginData?.data?.auth_token ||
    loginData?.data?.staff_token ||
    loginData?.token ||
    loginData?.access_token ||
    loginData?.session_token ||
    loginData?.auth_token ||
    loginData?.staff_token ||
    loginData?.api_token ||
    ''
  );
}

function getUser(loginData) {
  return loginData?.data?.user || loginData?.data?.staff || loginData?.user || loginData?.staff || {};
}

function money(value) {
  const n = Number(value || 0);
  const prefix = n < 0 ? '-â‚¹' : 'â‚¹';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${prefix}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${prefix}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${prefix}${(abs / 1000).toFixed(1)}K`;
  return `${prefix}${Math.round(abs)}`;
}

function shortNumber(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function valueText(item) {
  const key = String(item?.key || '').toLowerCase();
  const format = String(item?.format || '').toLowerCase();
  if (
    format === 'money' ||
    key.includes('sales') ||
    key.includes('payment') ||
    key.includes('amount') ||
    key.includes('revenue') ||
    key.includes('invoice')
  ) {
    return money(item?.value ?? item?.count ?? item?.total ?? 0);
  }
  return shortNumber(item?.value ?? item?.count ?? item?.total ?? 0);
}

function titleize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPath(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return acc[key];
      return undefined;
    }, obj);
}

function firstPath(obj, paths, fallback = undefined) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function firstArray(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.list)) return value.list;
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.data)) return value.data;
    }
  }
  return [];
}

function firstObject(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return {};
}

function getCountSource(dash) {
  return firstObject(dash, ['counts', 'summary', 'totals', 'dashboard_counts', 'kpi_counts']);
}

function pickNumber(obj, keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (val !== undefined && val !== null && val !== '') return Number(val || 0);
  }
  return 0;
}

function normalizeKpis(dash) {
  const apiKpis = firstArray(dash, ['kpis', 'cards', 'summary.kpis', 'dashboard.kpis']);
  if (apiKpis.length) {
    return apiKpis.map((item, index) => ({
      key: item.key || item.id || item.title || `kpi_${index}`,
      title: item.title || item.label || item.name || titleize(item.key || `KPI ${index + 1}`),
      sub: item.sub || item.subtitle || item.description || '',
      value: item.value ?? item.count ?? item.total ?? 0,
      format: item.format || item.type || '',
    }));
  }

  const c = getCountSource(dash);
  const kpis = [
    { key: 'new_queries', title: 'New Queries', value: pickNumber(c, ['new_queries', 'new', 'today_queries']), sub: 'Current period' },
    { key: 'total_queries', title: 'Total Queries', value: pickNumber(c, ['total_queries', 'queries', 'total']), sub: 'All queries' },
    { key: 'confirmed', title: 'Confirmed', value: pickNumber(c, ['confirmed', 'won', 'converted']), sub: 'Won queries' },
    { key: 'sales', title: 'Sales Value', value: pickNumber(c, ['sales', 'sales_value', 'revenue', 'invoice_amount']), sub: 'Confirmed value', format: 'money' },
    { key: 'followups', title: 'Follow-ups', value: pickNumber(c, ['followups', 'follow_ups', 'today_followups']), sub: 'Pending today' },
    { key: 'itineraries', title: 'Itineraries', value: pickNumber(c, ['itineraries', 'packages', 'quotations']), sub: 'Created' },
    { key: 'companies', title: 'Companies', value: pickNumber(c, ['companies', 'company']), sub: 'Accounts' },
    { key: 'pending_payments', title: 'Pending Payments', value: pickNumber(c, ['pending_payments', 'pending_amount', 'dues']), sub: 'Receivable', format: 'money' },
    { key: 'active_users', title: 'Active Users', value: pickNumber(c, ['active_users', 'users', 'staff']), sub: 'Staff' },
  ];

  return kpis;
}

function normalizeModules(dash, kpis) {
  const apiModules = firstArray(dash, ['modules', 'sections', 'all_sections']);
  if (apiModules.length) {
    return apiModules.map((m, index) => ({
      key: m.key || m.id || m.slug || String(m.title || m.name || index).toLowerCase(),
      title: m.title || m.name || m.label || titleize(m.key || `Module ${index + 1}`),
      count: m.count ?? m.value ?? m.total ?? 0,
      format: m.format || '',
      icon: m.icon || '',
    }));
  }

  const kpiByKey = {};
  kpis.forEach((k) => {
    kpiByKey[k.key] = k.value ?? 0;
  });

  return [
    { key: 'queries', title: 'Queries', count: kpiByKey.total_queries || kpiByKey.new_queries || 0, icon: 'â˜°' },
    { key: 'itinerary', title: 'Itinerary', count: kpiByKey.itineraries || 0, icon: 'â–¤' },
    { key: 'payments', title: 'Payments', count: kpiByKey.pending_payments || 0, icon: 'â–£', format: 'money' },
    { key: 'companies', title: 'Companies', count: kpiByKey.companies || 0, icon: 'â—«' },
    { key: 'whatsapp', title: 'WhatsApp', count: 0, icon: 'âœ†' },
    { key: 'email', title: 'Email', count: 0, icon: 'âœ‰' },
    { key: 'users_staff', title: 'Users/Staff', count: kpiByKey.active_users || 0, icon: 'ðŸ‘¥' },
    { key: 'organization', title: 'Organization', count: '', icon: 'ðŸ¢' },
    { key: 'theme', title: 'Theme', count: '', icon: 'â—ˆ' },
  ];
}

function normalizeTrend(dash) {
  return firstArray(dash, ['monthly_trend', 'monthlyTrend', 'trend', 'graph.monthly', 'query_trend']).map((item, index) => ({
    label: item.label || item.month || item.name || `M${index + 1}`,
    total: Number(item.total ?? item.value ?? item.count ?? item.queries ?? 0),
    won: Number(item.won ?? item.confirmed ?? item.converted ?? 0),
  }));
}

function normalizeProgressList(dash, paths) {
  return firstArray(dash, paths).map((item, index) => ({
    label: item.label || item.title || item.name || item.stage || item.service || item.source || item.destination || `Item ${index + 1}`,
    value: Number(item.value ?? item.count ?? item.total ?? item.amount ?? 0),
    sub: item.sub || item.subtitle || item.description || '',
  }));
}

function normalizeRecent(dash) {
  return firstArray(dash, ['recent_queries', 'recentQueries', 'queries_recent', 'recent']).map((q, index) => ({
    id: q.id || q.query_id || q.queryNo || q.query_no || index,
    title: q.title || q.name || q.lead_pax_name || q.customer || q.client_name || `Query ${index + 1}`,
    meta: q.destination || q.service || q.type || q.travel_date || '',
    status: q.status || q.stage || q.stage_name || 'Open',
    amount: q.amount || q.value || q.sales_value || '',
  }));
}

function normalizeFollowups(dash) {
  return firstArray(dash, ['today_followups', 'todays_followups', 'followups', 'follow_ups']).map((f, index) => ({
    id: f.id || index,
    title: f.title || f.name || f.customer || f.lead_pax_name || `Follow-up ${index + 1}`,
    time: f.time || f.followup_time || f.follow_up_time || f.date || f.followup_date || '',
    note: f.note || f.remark || f.description || f.status || '',
  }));
}

function normalizePayments(dash) {
  return firstArray(dash, ['pending_payments_list', 'pending_payment_list', 'payments_pending', 'pending_payments.rows', 'pending_payments.items']).map((p, index) => ({
    id: p.id || index,
    title: p.title || p.name || p.customer || p.client_name || p.company_name || `Payment ${index + 1}`,
    amount: p.amount ?? p.pending ?? p.balance ?? p.total ?? 0,
    due: p.due_date || p.date || p.payment_due_date || '',
    status: p.status || 'Pending',
  }));
}

function normalizeWeather(dash) {
  const value = firstPath(dash, ['weather', 'destination_weather']);
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function moduleToTab(title, key) {
  const k = String(key || title || '').toLowerCase();
  if (k.includes('quer')) return 'Queries';
  if (k.includes('itinerary') || k.includes('package')) return 'Itinerary';
  if (k.includes('payment')) return 'Payments';
  return 'More';
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [agentCode, setAgentCode] = useState('10001');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const saved = await SecureStore.getItemAsync(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.token && parsed?.apiBaseUrl) setSession(parsed);
      }
    } catch (e) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
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
      const resolveRes = await fetch(`${MANAGER_URL}?agent_code=${encodeURIComponent(agentCode.trim())}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const resolveData = await readJson(resolveRes);

      if (resolveData?.status === false || resolveData?.success === false) {
        throw new Error(resolveData?.message || 'Agent code invalid hai.');
      }

      const apiBaseUrl = normalizeApiBase(resolveData);
      const loginUrl = resolveData?.login_endpoint || `${apiBaseUrl}?endpoint=auth.login`;

      setMessage('CRM login ho raha hai...');

      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: username.trim(),
          password,
          agent_code: agentCode.trim(),
          platform: Platform.OS,
        }),
      });

      const loginData = await readJson(loginRes);

      if (loginData?.status === false || loginData?.success === false) {
        throw new Error(loginData?.message || loginData?.error || 'Login failed.');
      }

      const token = getToken(loginData);
      if (!token) throw new Error('Login API se token/session nahi mila.');

      const user = getUser(loginData);
      const newSession = {
        token,
        agentCode: agentCode.trim(),
        username: user.display_name || user.name || user.full_name || user.email || username.trim(),
        email: user.email || username.trim(),
        user,
        companyName: resolveData.company_name || user.company_name || 'Growin CRM',
        apiBaseUrl,
        loginAt: new Date().toISOString(),
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
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch (e) {}
    setSession(null);
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#12B76A" size="large" />
          <Text style={styles.muted}>Growin loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session) return <MainApp session={session} onLogout={logout} />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.loginLogoCircle}>
            <Text style={styles.loginLogoText}>G</Text>
          </View>
          <Text style={styles.logo}>Growin Staff</Text>
          <Text style={styles.logoSub}>Travel CRM Staff App</Text>

          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Welcome Back</Text>
            <Text style={styles.loginSub}>Sign in to continue</Text>

            <Text style={styles.label}>Agent Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 5 digit agent code"
              placeholderTextColor="#8A96A8"
              value={agentCode}
              onChangeText={setAgentCode}
              keyboardType="number-pad"
              maxLength={5}
            />

            <Text style={styles.label}>Username / Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter username or email"
              placeholderTextColor="#8A96A8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passRow}>
              <TextInput
                style={styles.passInput}
                placeholder="Enter password"
                placeholderTextColor="#8A96A8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.showBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            {!!message && <Text style={styles.errorText}>{message}</Text>}

            <Pressable style={[styles.signBtn, loginLoading && { opacity: 0.65 }]} onPress={handleSignIn} disabled={loginLoading}>
              {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signText}>Sign In</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MainApp({ session, onLogout }) {
  const [tab, setTab] = useState('Dashboard');
  const [search, setSearch] = useState('');

  const initial = (session.username || 'U').slice(0, 1).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.topSearch}>
          <Text style={styles.searchIcon}>âŒ•</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Growin..."
            placeholderTextColor="#97A3B6"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable style={styles.plusBtn}>
          <Text style={styles.plusText}>ï¼‹</Text>
        </Pressable>
        <Pressable style={styles.bellBtn}>
          <Text style={styles.bellDot}>â—</Text>
        </Pressable>
        <Pressable style={styles.profileBtn} onPress={onLogout}>
          <Text style={styles.profileText}>{initial}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'Dashboard' ? (
          <DashboardScreen session={session} setTab={setTab} />
        ) : (
          <ModuleScreen title={tab} session={session} setTab={setTab} />
        )}
      </View>

      <View style={styles.footerNav}>
        {['Dashboard', 'Queries', 'Itinerary', 'Payments', 'More'].map((name) => (
          <Pressable key={name} style={styles.navItem} onPress={() => setTab(name)}>
            <View style={[styles.navCircle, tab === name && styles.navCircleActive]}>
              <Text style={[styles.navIcon, tab === name && styles.navIconActive]}>{navIcon(name)}</Text>
            </View>
            <Text style={[styles.navText, tab === name && styles.navActive]}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function navIcon(name) {
  if (name === 'Dashboard') return 'âŒ‚';
  if (name === 'Queries') return 'â˜°';
  if (name === 'Itinerary') return 'â–¤';
  if (name === 'Payments') return 'â–£';
  return 'â€¢â€¢â€¢';
}

function DashboardScreen({ session, setTab }) {
  const [dash, setDash] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const data = await apiGet(session, 'dashboard.full', { range: 'month' });
      setDash(data || {});
    } catch (e) {
      setErr(e?.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpis = useMemo(() => normalizeKpis(dash), [dash]);
  const trend = useMemo(() => normalizeTrend(dash), [dash]);
  const pipeline = useMemo(() => normalizeProgressList(dash, ['pipeline', 'stage_pipeline', 'query_pipeline']), [dash]);
  const serviceMix = useMemo(() => normalizeProgressList(dash, ['service_mix', 'serviceMix', 'services_mix']), [dash]);
  const modules = useMemo(() => normalizeModules(dash, kpis), [dash, kpis]);
  const recent = useMemo(() => normalizeRecent(dash), [dash]);
  const followups = useMemo(() => normalizeFollowups(dash), [dash]);
  const pendingPayments = useMemo(() => normalizePayments(dash), [dash]);
  const topDestinations = useMemo(() => normalizeProgressList(dash, ['top_destinations', 'destinations', 'destination_mix']), [dash]);
  const leadSources = useMemo(() => normalizeProgressList(dash, ['lead_sources', 'leadSources', 'sources']), [dash]);
  const team = useMemo(() => firstArray(dash, ['team', 'staff', 'users', 'team_performance']), [dash]);
  const weather = useMemo(() => normalizeWeather(dash), [dash]);
  const loginSummary = useMemo(() => firstObject(dash, ['login', 'login_summary', 'app_login', 'login_count']), [dash]);
  const quickActions = useMemo(() => firstArray(dash, ['quick_actions', 'actions', 'shortcuts']), [dash]);

  const companyName = firstPath(dash, ['organization.company_name', 'company.name', 'company_name'], session.companyName);
  const period = firstPath(dash, ['period.label', 'current_period', 'period'], 'Current - Period');
  const userName = session?.username || session?.user?.name || 'Staff';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.dashboardWrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} tintColor="#12B76A" />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroSmall}>Dynamic Dashboard v2</Text>
        <Text style={styles.heroTitle}>Organization Dashboard</Text>
        <Text style={styles.heroCompany}>{companyName}</Text>
        <Text style={styles.heroPeriod}>{period}</Text>
        <Text style={styles.heroUser}>Logged in: {userName}</Text>
      </View>

      {err ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorStrong}>Dashboard API Error</Text>
          <Text style={styles.errorText}>{err}</Text>
        </View>
      ) : null}

      {loading && !Object.keys(dash || {}).length ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color="#12B76A" />
          <Text style={styles.muted}>Loading live CRM dashboard...</Text>
        </View>
      ) : null}

      <KpiGrid kpis={kpis} />

      <MonthlyTrend trend={trend} />

      <View style={styles.twoCol}>
        <SmallProgressCard title="Pipeline" items={pipeline} empty="No pipeline data" />
        <SmallProgressCard title="Service Mix" items={serviceMix} empty="No service data" />
      </View>

      <ModuleGrid modules={modules} setTab={setTab} />

      <ListCard title="Recent Queries" right="Latest" items={recent} empty="No recent queries" type="query" />

      <ListCard title="Today Follow-ups" right="Today" items={followups} empty="No follow-ups today" type="followup" />

      <ListCard title="Pending Payments" right="Due" items={pendingPayments} empty="No pending payments" type="payment" />

      <ProgressCard title="Top Destinations" right="Live" items={topDestinations} empty="No destination data" />

      <ProgressCard title="Lead Sources" right="Source" items={leadSources} empty="No lead source data" />

      <TeamCard team={team} />

      <WeatherCard weather={weather} />

      <LoginSummaryCard loginSummary={loginSummary} />

      <QuickActionsCard actions={quickActions} setTab={setTab} />

      <View style={{ height: 8 }} />
    </ScrollView>
  );
}

function KpiGrid({ kpis }) {
  const hasData = kpis.some((k) => Number(k.value || 0) > 0);

  return (
    <View style={styles.sectionBlock}>
      {!hasData ? <Text style={styles.sectionNote}>CRM se KPI data nahi mila.</Text> : null}
      <View style={styles.kpiGrid}>
        {kpis.slice(0, 10).map((item, index) => (
          <View key={`${item.key || item.title}-${index}`} style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{valueText(item)}</Text>
            <Text style={styles.kpiTitle}>{item.title}</Text>
            {!!item.sub && <Text style={styles.kpiSub}>{item.sub}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthlyTrend({ trend }) {
  const max = Math.max(1, ...trend.map((m) => Math.max(Number(m.total || 0), Number(m.won || 0))));

  return (
    <Card title="Monthly Trend" right="Live">
      {trend.length ? (
        <>
          <View style={styles.chartArea}>
            {trend.slice(0, 8).map((m, index) => (
              <View key={`${m.label}-${index}`} style={styles.chartCol}>
                <View style={styles.chartBars}>
                  <View style={[styles.barTotal, { height: Math.max(6, (Number(m.total || 0) / max) * 110) }]} />
                  <View style={[styles.barWon, { height: Math.max(6, (Number(m.won || 0) / max) * 110) }]} />
                </View>
                <Text style={styles.chartLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendTotal}>â— Total</Text>
            <Text style={styles.legendWon}>â— Won</Text>
          </View>
        </>
      ) : (
        <EmptyText text="No monthly trend data" />
      )}
    </Card>
  );
}

function SmallProgressCard({ title, items, empty }) {
  const max = Math.max(1, ...items.map((x) => Number(x.value || 0)));

  return (
    <View style={styles.smallCard}>
      <Text style={styles.smallTitle}>{title}</Text>
      {items.length ? (
        items.slice(0, 5).map((item, index) => (
          <ProgressLine key={`${item.label}-${index}`} item={item} max={max} compact />
        ))
      ) : (
        <Text style={styles.muted}>{empty}</Text>
      )}
    </View>
  );
}

function ProgressCard({ title, right, items, empty }) {
  const max = Math.max(1, ...items.map((x) => Number(x.value || 0)));

  return (
    <Card title={title} right={right}>
      {items.length ? (
        items.slice(0, 10).map((item, index) => <ProgressLine key={`${item.label}-${index}`} item={item} max={max} />)
      ) : (
        <EmptyText text={empty} />
      )}
    </Card>
  );
}

function ProgressLine({ item, max, compact }) {
  const percent = Math.min(100, Math.round((Number(item.value || 0) / max) * 100));
  return (
    <View style={compact ? styles.progressRowCompact : styles.progressRow}>
      <View style={styles.progressTop}>
        <Text style={compact ? styles.progressLabelCompact : styles.progressLabel} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={styles.progressValue}>{shortNumber(item.value)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, percent)}%` }]} />
      </View>
    </View>
  );
}

function ModuleGrid({ modules, setTab }) {
  return (
    <Card title="All Sections" right="Open">
      <View style={styles.moduleGrid}>
        {modules.map((m, index) => (
          <Pressable key={`${m.key}-${index}`} style={styles.moduleCard} onPress={() => setTab(moduleToTab(m.title, m.key))}>
            <Text style={styles.moduleIcon}>{m.icon || 'â–¦'}</Text>
            <Text style={styles.moduleName} numberOfLines={1}>{m.title}</Text>
            <Text style={styles.moduleCount}>{m.format === 'money' ? money(m.count) : String(m.count ?? '')}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function ListCard({ title, right, items, empty, type }) {
  return (
    <Card title={title} right={right}>
      {items.length ? (
        items.slice(0, 12).map((item, index) => <ListRow key={`${item.id}-${index}`} item={item} type={type} />)
      ) : (
        <EmptyText text={empty} />
      )}
    </Card>
  );
}

function ListRow({ item, type }) {
  if (type === 'payment') {
    return (
      <View style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowMeta}>{item.due || 'Due date'} â€¢ {item.status}</Text>
        </View>
        <Text style={styles.rowAmount}>{money(item.amount)}</Text>
      </View>
    );
  }

  if (type === 'followup') {
    return (
      <View style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowMeta}>{item.time || 'Today'} â€¢ {item.note || 'Follow-up'}</Text>
        </View>
        <Text style={styles.statusPill}>Open</Text>
      </View>
    );
  }

  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowMeta}>{item.meta || 'Destination'} â€¢ {item.status || 'Open'}</Text>
      </View>
      <Text style={styles.statusPill}>{item.status || 'Open'}</Text>
    </View>
  );
}

function TeamCard({ team }) {
  return (
    <Card title="Team / Staff" right="Users">
      {team.length ? (
        team.slice(0, 12).map((u, index) => {
          const name = u.name || u.display_name || u.username || u.email || `Staff ${index + 1}`;
          const role = u.role || u.profile || u.designation || u.status || 'Staff';
          const value = u.value ?? u.count ?? u.queries ?? u.sales ?? '';
          return (
            <View key={`${name}-${index}`} style={styles.teamRow}>
              <View style={styles.avatarMini}>
                <Text style={styles.avatarMiniText}>{String(name).slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
                <Text style={styles.rowMeta}>{role}</Text>
              </View>
              <Text style={styles.rowAmount}>{value !== '' ? shortNumber(value) : 'â€¢'}</Text>
            </View>
          );
        })
      ) : (
        <EmptyText text="No staff/team data" />
      )}
    </Card>
  );
}

function WeatherCard({ weather }) {
  return (
    <Card title="Destination Weather" right={weather.length ? 'Live' : 'Off'}>
      {weather.length ? (
        <View style={styles.weatherGrid}>
          {weather.slice(0, 6).map((w, index) => {
            const name = w.name || w.city || w.location || `City ${index + 1}`;
            const temp = w.temperature ?? w.temp ?? w.current_temp ?? '--';
            const condition = w.condition || w.description || w.status || 'Weather';
            return (
              <View key={`${name}-${index}`} style={styles.weatherMini}>
                <Text style={styles.weatherCity} numberOfLines={1}>{name}</Text>
                <Text style={styles.weatherTemp}>{temp !== '--' ? `${temp}Â°` : '--'}</Text>
                <Text style={styles.weatherCond} numberOfLines={1}>{condition}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyText text="Weather data available nahi hai." />
      )}
    </Card>
  );
}

function LoginSummaryCard({ loginSummary }) {
  const entries = Object.keys(loginSummary || {})
    .filter((key) => typeof loginSummary[key] !== 'object')
    .slice(0, 8)
    .map((key) => ({ label: titleize(key), value: loginSummary[key] }));

  return (
    <Card title="App Login Summary" right="Staff">
      {entries.length ? (
        entries.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{String(item.value)}</Text>
          </View>
        ))
      ) : (
        <EmptyText text="Login summary data nahi mila." />
      )}
    </Card>
  );
}

function QuickActionsCard({ actions, setTab }) {
  const fallback = [
    { title: 'Add Query', target: 'Queries' },
    { title: 'Create Itinerary', target: 'Itinerary' },
    { title: 'Record Payment', target: 'Payments' },
    { title: 'More Modules', target: 'More' },
  ];

  const list = actions.length
    ? actions.map((a, index) => ({
        title: a.title || a.label || a.name || `Action ${index + 1}`,
        target: a.target || a.module || 'More',
      }))
    : fallback;

  return (
    <Card title="Quick Actions" right="Open">
      <View style={styles.quickGrid}>
        {list.slice(0, 8).map((a, index) => (
          <Pressable key={`${a.title}-${index}`} style={styles.quickAction} onPress={() => setTab(moduleToTab(a.target, a.target))}>
            <Text style={styles.quickPlus}>ï¼‹</Text>
            <Text style={styles.quickTitle}>{a.title}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function Card({ title, right, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {!!right && <Text style={styles.cardRight}>{right}</Text>}
      </View>
      {children}
    </View>
  );
}

function EmptyText({ text }) {
  return <Text style={styles.muted}>{text}</Text>;
}

function ModuleScreen({ title, setTab }) {
  const modules = [
    'Queries',
    'Itinerary',
    'Payments',
    'Company',
    'WhatsApp',
    'Email',
    'Profile',
    'Users/Staff',
    'Organization',
    'Theme',
  ];

  if (title === 'More') {
    return (
      <ScrollView contentContainerStyle={styles.moduleScreenScroll}>
        <Text style={styles.moduleBig}>More Modules</Text>
        <Text style={styles.moduleHint}>Staff app ke required modules yaha se open honge.</Text>
        <View style={styles.moreList}>
          {modules.map((m) => (
            <Pressable key={m} style={styles.moreRow} onPress={() => setTab(m)}>
              <Text style={styles.moreTitle}>{m}</Text>
              <Text style={styles.moreArrow}>â€º</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.moduleScreen}>
      <Text style={styles.moduleBig}>{title}</Text>
      <Text style={styles.moduleHint}>Is module ka native listing/form next API se connect hoga.</Text>
      <Pressable style={styles.backDashBtn} onPress={() => setTab('Dashboard')}>
        <Text style={styles.backDashText}>Back to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const GREEN = '#12B76A';
const DARK = '#053B46';
const TEXT = '#111C33';
const MUTED = '#748094';
const BG = '#F4FAF8';
const BORDER = '#DDE7EA';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: MUTED, fontWeight: '700', lineHeight: 20 },

  loginWrap: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  loginLogoCircle: { width: 74, height: 74, borderRadius: 26, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  loginLogoText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  logo: { fontSize: 34, fontWeight: '900', color: DARK, textAlign: 'center' },
  logoSub: { fontSize: 15, fontWeight: '700', color: GREEN, textAlign: 'center', marginTop: 4, marginBottom: 22 },
  loginCard: { backgroundColor: '#fff', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: BORDER },
  loginTitle: { fontSize: 26, fontWeight: '900', color: TEXT, textAlign: 'center' },
  loginSub: { fontSize: 14, color: '#6B7688', textAlign: 'center', marginTop: 7, marginBottom: 22 },
  label: { fontSize: 13, color: '#43536A', fontWeight: '800', marginBottom: 8, marginLeft: 4 },
  input: { height: 56, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, paddingHorizontal: 18, fontSize: 16, marginBottom: 15, color: TEXT },
  passRow: { height: 56, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, paddingLeft: 18, paddingRight: 8, marginBottom: 15, flexDirection: 'row', alignItems: 'center' },
  passInput: { flex: 1, fontSize: 16, color: TEXT, height: '100%' },
  showBtn: { paddingHorizontal: 13, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F7F1' },
  showText: { color: '#069957', fontWeight: '900', fontSize: 13 },
  errorText: { color: '#B42318', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  signBtn: { height: 56, borderRadius: 17, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  signText: { color: '#fff', fontSize: 17, fontWeight: '900' },

  topBar: { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  topSearch: { flex: 1, height: 54, borderRadius: 25, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginRight: 10 },
  searchIcon: { fontSize: 20, color: '#93A1B2', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 17, color: TEXT },
  plusBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  plusText: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 38 },
  bellBtn: { width: 42, height: 54, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bellDot: { color: '#FF4D5A', fontSize: 22 },
  profileBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#B7EBC7', alignItems: 'center', justifyContent: 'center' },
  profileText: { color: DARK, fontWeight: '900', fontSize: 18 },

  dashboardWrap: { padding: 20, paddingBottom: 94 },
  heroCard: { backgroundColor: '#087B69', borderRadius: 28, padding: 24, marginBottom: 18 },
  heroSmall: { color: '#D7FBE8', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 29, fontWeight: '900', lineHeight: 35 },
  heroCompany: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 8 },
  heroPeriod: { color: '#F2FFFA', fontSize: 17, fontWeight: '900', marginTop: 12 },
  heroUser: { color: '#D7FBE8', fontSize: 12, fontWeight: '800', marginTop: 8 },
  centerBlock: { padding: 30, alignItems: 'center' },
  errorCard: { backgroundColor: '#FFF1F0', borderColor: '#FDA29B', borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 18 },
  errorStrong: { color: '#B42318', fontWeight: '900', marginBottom: 6, fontSize: 16 },

  sectionBlock: { marginBottom: 2 },
  sectionNote: { color: '#748094', fontWeight: '900', marginBottom: 14, fontSize: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiCard: { width: '48%', backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  kpiValue: { color: DARK, fontSize: 25, fontWeight: '900' },
  kpiTitle: { color: TEXT, fontSize: 13, fontWeight: '900', marginTop: 8 },
  kpiSub: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 3 },

  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginTop: 16, borderWidth: 1, borderColor: BORDER },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 21, fontWeight: '900', color: TEXT },
  cardRight: { color: GREEN, fontWeight: '900', fontSize: 15 },

  chartArea: { height: 152, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartCol: { flex: 1, alignItems: 'center' },
  chartBars: { height: 122, flexDirection: 'row', alignItems: 'flex-end', columnGap: 4 },
  barTotal: { width: 14, borderRadius: 10, backgroundColor: DARK },
  barWon: { width: 14, borderRadius: 10, backgroundColor: GREEN },
  chartLabel: { color: MUTED, fontWeight: '900', fontSize: 12, marginTop: 8 },
  legendRow: { flexDirection: 'row', columnGap: 18, marginTop: 8 },
  legendTotal: { color: DARK, fontWeight: '900' },
  legendWon: { color: GREEN, fontWeight: '900' },

  twoCol: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  smallCard: { width: '48%', backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: BORDER, minHeight: 118 },
  smallTitle: { fontSize: 20, fontWeight: '900', color: TEXT, marginBottom: 12 },

  progressRow: { marginBottom: 14 },
  progressRowCompact: { marginBottom: 11 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: TEXT, fontWeight: '800', flex: 1, paddingRight: 10 },
  progressLabelCompact: { color: TEXT, fontWeight: '800', flex: 1, paddingRight: 8, fontSize: 12 },
  progressValue: { color: DARK, fontWeight: '900', fontSize: 12 },
  progressTrack: { height: 9, borderRadius: 9, backgroundColor: '#EAF1F3', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 9 },

  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moduleCard: { width: '31%', backgroundColor: '#F4FAF8', borderRadius: 20, padding: 12, minHeight: 98, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  moduleIcon: { fontSize: 22, color: GREEN, fontWeight: '900', marginBottom: 8 },
  moduleName: { color: TEXT, fontWeight: '900', fontSize: 12, textAlign: 'center' },
  moduleCount: { color: MUTED, fontWeight: '900', fontSize: 14, marginTop: 5 },

  listRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF3F5', flexDirection: 'row', alignItems: 'center' },
  rowTitle: { color: TEXT, fontSize: 15, fontWeight: '900' },
  rowMeta: { color: MUTED, marginTop: 4, fontWeight: '700', fontSize: 12 },
  rowAmount: { color: GREEN, fontWeight: '900', fontSize: 13, marginLeft: 8 },
  statusPill: { color: GREEN, fontWeight: '900', fontSize: 12, backgroundColor: '#E9F9F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, marginLeft: 8 },

  teamRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3F5', flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E9F9F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarMiniText: { color: GREEN, fontWeight: '900' },

  weatherGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  weatherMini: { width: '48%', backgroundColor: '#F4FAF8', borderRadius: 18, padding: 14, minHeight: 104, marginBottom: 12 },
  weatherCity: { color: TEXT, fontWeight: '900', fontSize: 13 },
  weatherTemp: { color: DARK, fontWeight: '900', fontSize: 28, marginTop: 8 },
  weatherCond: { color: MUTED, fontWeight: '700', fontSize: 11, marginTop: 2 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF3F5' },
  summaryLabel: { color: TEXT, fontWeight: '800' },
  summaryValue: { color: GREEN, fontWeight: '900' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickAction: { width: '48%', backgroundColor: '#F4FAF8', borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  quickPlus: { width: 28, height: 28, borderRadius: 14, backgroundColor: GREEN, color: '#fff', textAlign: 'center', lineHeight: 28, fontSize: 19, fontWeight: '900', marginRight: 10 },
  quickTitle: { flex: 1, color: TEXT, fontWeight: '900', fontSize: 13 },

  footerNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 82, backgroundColor: DARK, borderTopWidth: 0, flexDirection: 'row', paddingTop: 9, paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center' },
  navCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navCircleActive: { backgroundColor: GREEN },
  navIcon: { color: '#D4E8EC', fontSize: 20, fontWeight: '900' },
  navIconActive: { color: '#fff' },
  navText: { color: '#D4E8EC', fontSize: 11, fontWeight: '900', marginTop: 3 },
  navActive: { color: '#fff' },

  moduleScreen: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  moduleScreenScroll: { padding: 22, paddingBottom: 110 },
  moduleBig: { fontSize: 26, fontWeight: '900', color: TEXT, marginBottom: 8, textAlign: 'center' },
  moduleHint: { color: MUTED, textAlign: 'center', fontWeight: '700', lineHeight: 22, marginBottom: 16 },
  moreList: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  moreRow: { minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEF3F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreTitle: { color: TEXT, fontWeight: '900', fontSize: 15 },
  moreArrow: { color: GREEN, fontSize: 28, fontWeight: '900' },
  backDashBtn: { backgroundColor: GREEN, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16 },
  backDashText: { color: '#fff', fontWeight: '900' },
});
