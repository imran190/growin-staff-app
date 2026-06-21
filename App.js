import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const MANAGER_URL = 'https://crm.travbizz.com/growin_manager/growin_resolve_agent.php';
const SESSION_KEY = 'growin_staff_session_dashboard_live_v2';
const BUILD_TAG = 'Growin Dashboard Live v2';

function cleanSlash(v) { return String(v || '').replace(/\/+$/, ''); }
function textValue(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    if (v.label) return textValue(v.label);
    if (v.title) return textValue(v.title);
    if (v.name) return textValue(v.name);
    if (v.value !== undefined) return textValue(v.value);
    if (v.range || v.from || v.to) {
      const range = textValue(v.range);
      const from = textValue(v.from_display || v.from);
      const to = textValue(v.to_display || v.to);
      if (from || to) return `${range ? range + ' • ' : ''}${from}${from && to ? ' - ' : ''}${to}`;
      return range;
    }
    return '';
  }
  return String(v);
}
function first(...values) { for (const v of values) { const t = textValue(v); if (t !== '') return t; } return ''; }
function arr(v) { if (Array.isArray(v)) return v; if (Array.isArray(v?.items)) return v.items; if (Array.isArray(v?.rows)) return v.rows; if (Array.isArray(v?.list)) return v.list; if (Array.isArray(v?.data)) return v.data; return []; }
function money(v) {
  const n = Number(v || 0);
  const fixed = Math.round(n).toLocaleString('en-IN');
  return `INR ${fixed}`;
}
function shortMoney(v) {
  const n = Number(v || 0);
  if (n >= 10000000) return 'INR ' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return 'INR ' + (n / 100000).toFixed(1) + 'L';
  return money(n);
}
function num(v) { return String(Math.round(Number(v || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatYMD(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function parseYMD(value) {
  if (!value) return new Date();
  const p = String(value).split('-').map(Number);
  if (p.length !== 3 || p.some((x) => !x)) return new Date(value);
  return new Date(p[0], p[1] - 1, p[2]);
}
function ddmmyyyy(value) { const d = parseYMD(value); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; }
function buildApiBase(resolveData) {
  const loginEndpoint = String(resolveData?.login_endpoint || '');
  if (loginEndpoint.includes('growin_api.php')) return loginEndpoint.split('?')[0];
  const apiBase = String(resolveData?.api_base_url || resolveData?.api_url || '');
  if (apiBase.includes('growin_api.php')) return apiBase.split('?')[0];
  if (apiBase) return `${cleanSlash(apiBase)}/growin_app/growin_api.php`;
  const crmUrl = String(resolveData?.crm_url || 'https://crm.travbizz.com/');
  return `${cleanSlash(crmUrl)}/growin_app/growin_api.php`;
}
function makeUrl(baseUrl, endpoint, params = {}, token = '') {
  const all = { endpoint, ...params };
  if (token) {
    all.token = token; all.auth_token = token; all.session_token = token; all.access_token = token; all.staff_token = token; all.growin_token = token;
  }
  const query = Object.keys(all).filter((k) => all[k] !== undefined && all[k] !== null && all[k] !== '').map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(all[k]))}`).join('&');
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
}
async function parseJson(res) {
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { throw new Error(text ? text.slice(0, 180) : 'Invalid API response'); }
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return json;
}
function okStatus(json) { return !(json?.status === false || json?.success === false); }
function apiHeaders(token) { return { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Token: token, token, 'X-Auth-Token': token, 'X-Growin-Token': token, 'X-Access-Token': token }; }
async function apiGet(session, endpoint, params = {}) {
  const res = await fetch(makeUrl(session.apiBaseUrl, endpoint, params, session.token), { method: 'GET', headers: apiHeaders(session.token) });
  const json = await parseJson(res);
  if (!okStatus(json)) throw new Error(json?.message || 'API failed');
  return json?.data || json?.payload || json?.result || json;
}
function getToken(loginData) { return first(loginData?.data?.token, loginData?.data?.access_token, loginData?.data?.session_token, loginData?.data?.auth_token, loginData?.token, loginData?.access_token, loginData?.session_token, loginData?.auth_token); }
function getUser(loginData) { return loginData?.data?.user || loginData?.user || loginData?.staff || {}; }
function defaultDates() { const now = new Date(); return { from: formatYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to: formatYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; }
function kpiFind(kpis, keys) { return kpis.find((x) => keys.some((k) => `${first(x.key)} ${first(x.title)} ${first(x.label)}`.toLowerCase().includes(k))) || null; }
function kpiNumber(item) { return Number(item?.value ?? item?.count ?? item?.total ?? 0); }
function statusText(v) { return first(v, 'On Going'); }
function weatherIconName(row) {
  const s = `${first(row.icon_key, row.condition, row.weather_label, row.status)}`.toLowerCase();
  if (s.includes('rain') || s.includes('drizzle') || s.includes('shower')) return 'rainy';
  if (s.includes('storm') || s.includes('thunder')) return 'thunderstorm';
  if (s.includes('snow')) return 'snow';
  if (s.includes('sun') || s.includes('clear')) return 'sunny';
  if (s.includes('cloud') || s.includes('overcast')) return 'partly-sunny';
  if (s.includes('mist') || s.includes('fog') || s.includes('haze')) return 'cloudy';
  return 'partly-sunny';
}
function normalizeDashboard(raw) {
  const d = raw?.dashboard || raw?.data?.dashboard || raw?.data || raw || {};
  const kpis = arr(d.kpis || d.summary || d.counts);
  const periodObj = d.period || d.current_period || {};
  const totalQueries = kpiFind(kpis, ['total quer']);
  const confirmedQueries = kpiFind(kpis, ['confirmed quer', 'won quer']);
  const confirmedValue = kpiFind(kpis, ['confirmed query value', 'confirmed value', 'sales value']);
  const departures = kpiFind(kpis, ['confirmed departure', 'departure']);
  const collection = kpiFind(kpis, ['collection', 'received']);
  const supplierPayables = kpiFind(kpis, ['supplier payable', 'supplier payables']);
  const followups = arr(d.today_followups || d.followups || d.todayFollowUps);
  const supplierPayments = arr(d.pending_supplier_payments || d.supplier_payments || d.supplier_payables_list || d.pending_payments);
  const notifications = arr(d.notifications || d.reminders || d.notification_list || d.alerts);
  const users = arr(d.filters?.users || d.users);
  return {
    build: first(d.build, BUILD_TAG),
    company: first(d.company, d.company_name, d.organization, d.organization_name, 'TravBizz CRM'),
    periodObj,
    periodText: first(periodObj),
    filters: d.filters || {},
    userOptions: users.length ? users : [{ id: 0, name: 'All Users' }],
    cards: [
      { key: 'total_queries', title: 'Total Queries', value: kpiNumber(totalQueries), sub: first(totalQueries?.sub, 'All active queries'), icon: 'chatbox-ellipses-outline', format: 'number' },
      { key: 'confirmed_queries', title: 'Confirmed Queries', value: kpiNumber(confirmedQueries), sub: first(confirmedQueries?.sub, 'Selected period'), icon: 'checkbox-outline', format: 'number' },
      { key: 'confirmed_query_value', title: 'Confirmed Query Value', value: kpiNumber(confirmedValue), sub: first(confirmedValue?.sub, 'Confirmed value'), icon: 'document-text-outline', format: 'money' },
      { key: 'confirmed_departures', title: 'Confirmed Departures', value: kpiNumber(departures), sub: first(departures?.sub, 'Upcoming travel'), icon: 'airplane-outline', format: 'number' },
      { key: 'collection_received', title: 'Collection Received', value: kpiNumber(collection), sub: first(collection?.sub, 'Paid billing'), icon: 'briefcase-outline', format: 'money' },
      { key: 'supplier_payables', title: 'Supplier Payables', value: kpiNumber(supplierPayables), sub: first(supplierPayables?.sub, 'Due and unpaid'), icon: 'cash-outline', format: 'money' }
    ],
    followups,
    pipeline: arr(d.query_pipeline || d.pipeline || d.stage_pipeline),
    supplierPayments,
    tours: arr(d.ongoing_upcoming_tours || d.ongoingUpcomingTours || d.upcoming_tours || d.confirmed_departures || d.departures || d.tours),
    topDestinations: arr(d.top_destinations || d.destinations || d.topDestinations).slice(0, 5),
    team: arr(d.team_performance || d.teamPerformance || d.team || d.staff || d.users),
    weather: arr(d.destination_weather || d.weather || d.destinationWeather),
    notifications,
    notificationsCount: Number(d.notifications_unread ?? d.reminders_unread ?? notifications.length),
    license: d.license || d.plan || d.subscription || {},
    user: d.user || {}
  };
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

  useEffect(() => { loadSession(); }, []);
  async function loadSession() {
    try { const saved = await SecureStore.getItemAsync(SESSION_KEY); if (saved) { const parsed = JSON.parse(saved); if (parsed?.token && parsed?.apiBaseUrl) setSession(parsed); } } catch (e) { await SecureStore.deleteItemAsync(SESSION_KEY); }
    setBooting(false);
  }
  async function handleSignIn() {
    if (!agentCode.trim() || !username.trim() || !password) { setMessage('Agent Code, Username aur Password required hai.'); return; }
    setLoginLoading(true); setMessage('Agent code check ho raha hai...');
    try {
      const resolveRes = await fetch(`${MANAGER_URL}?agent_code=${encodeURIComponent(agentCode.trim())}`, { headers: { Accept: 'application/json' } });
      const resolveData = await parseJson(resolveRes);
      if (!okStatus(resolveData)) throw new Error(resolveData?.message || 'Agent code invalid hai.');
      const apiBaseUrl = buildApiBase(resolveData);
      setMessage('CRM login ho raha hai...');
      const loginRes = await fetch(makeUrl(apiBaseUrl, 'auth.login'), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), email: username.trim(), password, agent_code: agentCode.trim(), platform: Platform.OS }) });
      const loginData = await parseJson(loginRes);
      if (!okStatus(loginData)) throw new Error(loginData?.message || 'Login failed.');
      const token = getToken(loginData);
      if (!token) throw new Error('Login API se token/session nahi mila.');
      const user = getUser(loginData);
      const next = { token, agentCode: agentCode.trim(), username: first(user.display_name, user.name, user.username, user.email, username.trim()), email: first(user.email, username.trim()), user, companyName: first(resolveData.company_name, resolveData.company, 'TravBizz CRM'), crmUrl: first(resolveData.crm_url, resolveData.api_base_url, 'https://crm.travbizz.com/'), apiBaseUrl, loginAt: new Date().toISOString() };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next)); setSession(next); setPassword(''); setMessage('');
    } catch (e) { const msg = e?.message || 'Login request failed.'; setMessage(msg); Alert.alert('Login Error', msg); }
    finally { setLoginLoading(false); }
  }
  async function logout() { try { await SecureStore.deleteItemAsync(SESSION_KEY); } catch (e) {} setSession(null); }
  if (booting) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#06C36B" size="large" /><Text style={styles.muted}>Growin loading...</Text></View></SafeAreaView>;
  if (session) return <MainApp session={session} onLogout={logout} />;
  return <LoginScreen agentCode={agentCode} setAgentCode={setAgentCode} username={username} setUsername={setUsername} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} message={message} loginLoading={loginLoading} handleSignIn={handleSignIn} />;
}

function LoginScreen({ agentCode, setAgentCode, username, setUsername, password, setPassword, showPassword, setShowPassword, message, loginLoading, handleSignIn }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.logoCircle}><Text style={styles.logoLetter}>G</Text></View>
          <Text style={styles.logo}>Growin Staff</Text><Text style={styles.logoSub}>Travel CRM Staff App</Text>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Welcome Back</Text><Text style={styles.loginSub}>Sign in to continue</Text>
            <Text style={styles.label}>Agent Code</Text><TextInput style={styles.input} placeholder="Enter 5 digit agent code" placeholderTextColor="#8A96A8" value={agentCode} onChangeText={setAgentCode} keyboardType="number-pad" maxLength={5} />
            <Text style={styles.label}>Username / Email</Text><TextInput style={styles.input} placeholder="Enter username or email" placeholderTextColor="#8A96A8" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Password</Text>
            <View style={styles.passRow}><TextInput style={styles.passInput} placeholder="Enter password" placeholderTextColor="#8A96A8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} /><Pressable style={styles.showBtn} onPress={() => setShowPassword(!showPassword)}><Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View>
            {!!message && <Text style={styles.errorText}>{message}</Text>}
            <Pressable style={[styles.signBtn, loginLoading && { opacity: 0.65 }]} onPress={handleSignIn} disabled={loginLoading}>{loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signText}>Sign In</Text>}</Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MainApp({ session, onLogout }) {
  const defaults = useMemo(() => defaultDates(), []);
  const [search, setSearch] = useState('');
  const [dash, setDash] = useState(normalizeDashboard({}));
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [range, setRange] = useState('month');
  const [userId, setUserId] = useState(0);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [pickerFor, setPickerFor] = useState(null);
  const [dropdownFor, setDropdownFor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const initial = first(session.username, session.email, 'U').slice(0, 1).toUpperCase();

  const loadDashboard = useCallback(async (opts = {}) => {
    const nextRange = opts.range ?? range;
    const nextFrom = opts.fromDate ?? fromDate;
    const nextTo = opts.toDate ?? toDate;
    const nextUserId = opts.userId ?? userId;
    setLoading(true); setErr('');
    try {
      const params = { range: nextRange };
      if (nextRange === 'custom') { params.from = nextFrom; params.to = nextTo; }
      if (Number(nextUserId) > 0) params.user_id = nextUserId;
      const data = await apiGet(session, 'dashboard.full', params);
      setRaw(data); setDash(normalizeDashboard(data));
    } catch (e) { setErr(e?.message || 'Unable to load dashboard'); }
    finally { setLoading(false); }
  }, [session, range, fromDate, toDate, userId]);
  useEffect(() => { loadDashboard({ range: 'month', fromDate: defaults.from, toDate: defaults.to, userId: 0 }); }, []);
  function applyDashboard() { loadDashboard({ range, fromDate, toDate, userId }); }
  function chooseRange(next) { setRange(next); setDropdownFor(null); if (next !== 'custom') loadDashboard({ range: next, fromDate, toDate, userId }); }
  function chooseUser(next) { setUserId(Number(next)); setDropdownFor(null); loadDashboard({ range, fromDate, toDate, userId: Number(next) }); }
  const selectedUserLabel = first((dash.userOptions || []).find((u) => Number(u.id) === Number(userId))?.name, 'All Users');
  const rangeTitle = range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'year' ? 'This Year' : range === 'custom' ? 'Custom' : 'This Month';
  function onTouchStart(e) { const t = e.nativeEvent; touchStart.current = { x: t.pageX, y: t.pageY }; }
  function onTouchEnd(e) { const t = e.nativeEvent; const start = touchStart.current; const width = Dimensions.get('window').width; if (start.x > width - 36 && start.x - t.pageX > 55) setProfileOpen(true); }
  return (
    <SafeAreaView style={styles.safe} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TopHeader search={search} setSearch={setSearch} initial={initial} notificationsCount={dash.notificationsCount} onBell={() => setNotificationsOpen(true)} onProfile={() => setProfileOpen(true)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.dashboardWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={applyDashboard} tintColor="#06C36B" />}>
        <FilterPanel selectedUserLabel={selectedUserLabel} selectedRangeLabel={rangeTitle} fromDate={fromDate} toDate={toDate} setDropdownFor={setDropdownFor} setPickerFor={setPickerFor} applyDashboard={applyDashboard} />
        {err ? <View style={styles.errorCard}><Text style={styles.errorStrong}>Dashboard API Error</Text><Text style={styles.errorText}>{err}</Text></View> : null}
        {loading && !raw ? <View style={styles.centerBlock}><ActivityIndicator color="#06C36B" /><Text style={styles.muted}>Loading live dashboard...</Text></View> : null}
        <KpiCards cards={dash.cards} />
        <TodayFollowups items={dash.followups} />
        <QueryPipeline items={dash.pipeline} />
        <PendingSupplierPayments items={dash.supplierPayments} />
        <UpcomingTours items={dash.tours} />
        <TopDestinations items={dash.topDestinations} />
        <TeamPerformance items={dash.team} />
        <DestinationWeather items={dash.weather} />
      </ScrollView>
      <NotificationModal visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} dash={dash} />
      <ProfileDrawer visible={profileOpen} onClose={() => setProfileOpen(false)} session={session} dash={dash} onLogout={onLogout} />
      <DropdownModal visible={!!dropdownFor} dropdownFor={dropdownFor} onClose={() => setDropdownFor(null)} users={dash.userOptions} chooseUser={chooseUser} range={range} chooseRange={chooseRange} />
      <DatePickerModal visible={!!pickerFor} pickerFor={pickerFor} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onClose={() => setPickerFor(null)} />
    </SafeAreaView>
  );
}

function TopHeader({ search, setSearch, initial, notificationsCount, onBell, onProfile }) {
  return <View style={styles.topBar}><View style={styles.searchPill}><Ionicons name="search" size={15} color="#8A96A8" /><TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor="#8A96A8" value={search} onChangeText={setSearch} /></View><Pressable style={styles.bellBtn} onPress={onBell}><Ionicons name="notifications-outline" size={21} color="#D8FFF0" />{notificationsCount > 0 ? <View style={styles.notifyBadge}><Text style={styles.notifyBadgeText}>{notificationsCount > 99 ? '99+' : notificationsCount}</Text></View> : null}</Pressable><Pressable style={styles.profileBtn} onPress={onProfile}><Text style={styles.profileText}>{initial}</Text></Pressable></View>;
}
function FilterPanel({ selectedUserLabel, selectedRangeLabel, fromDate, toDate, setDropdownFor, setPickerFor, applyDashboard }) {
  return <View style={styles.filterHero}><View style={styles.filterTitleRow}><View style={styles.gaugeIcon}><Ionicons name="speedometer-outline" size={18} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.filterTitle}>Organization Dashboard</Text><Text style={styles.filterSubtitle}>All users • Live travel CRM overview • {ddmmyyyy(fromDate)} - {ddmmyyyy(toDate)}</Text></View></View><Pressable style={styles.dropdownWide} onPress={() => setDropdownFor('dashboard')}><Text style={styles.dropdownText}>Organization Dashboard</Text><Ionicons name="chevron-down" size={16} color="#03172D" /></Pressable><View style={styles.filterTwoCol}><Pressable style={styles.dropdownHalf} onPress={() => setDropdownFor('user')}><Text style={styles.dropdownText}>{selectedUserLabel}</Text><Ionicons name="chevron-down" size={16} color="#03172D" /></Pressable><Pressable style={styles.dropdownHalf} onPress={() => setDropdownFor('range')}><Text style={styles.dropdownText}>{selectedRangeLabel}</Text><Ionicons name="chevron-down" size={16} color="#03172D" /></Pressable></View><View style={styles.filterTwoCol}><Pressable style={styles.dateHalf} onPress={() => setPickerFor('from')}><Ionicons name="calendar-outline" size={16} color="#006D68" /><Text style={styles.dateBig}>{ddmmyyyy(fromDate)}</Text></Pressable><Pressable style={styles.dateHalf} onPress={() => setPickerFor('to')}><Ionicons name="calendar-outline" size={16} color="#006D68" /><Text style={styles.dateBig}>{ddmmyyyy(toDate)}</Text></Pressable></View><Pressable style={styles.applyBigBtn} onPress={applyDashboard}><Text style={styles.applyBigText}>Apply</Text></Pressable></View>;
}
function KpiCards({ cards }) { return <View style={styles.kpiGrid}>{cards.map((card) => <View key={card.key} style={styles.kpiCard}><View style={styles.kpiTop}><View style={styles.kpiIconCircle}><Ionicons name={card.icon} size={17} color="#00A86B" /></View><View style={styles.openCircle}><Ionicons name="arrow-up-outline" size={14} color="#06C36B" style={{ transform: [{ rotate: '45deg' }] }} /></View></View><Text style={styles.kpiTitle}>{card.title}</Text><Text style={styles.kpiValue}>{card.format === 'money' ? shortMoney(card.value) : num(card.value)}</Text><Text style={styles.kpiSub}>{card.sub}</Text></View>)}</View>; }
function Section({ icon, title, subtitle, children }) { return <View style={styles.sectionCard}><View style={styles.sectionHead}><View style={styles.sectionHeadLeft}><View style={styles.sectionIconCircle}><Ionicons name={icon} size={17} color="#00A86B" /></View><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View><View style={styles.sectionOpen}><Ionicons name="arrow-up-outline" size={14} color="#06C36B" style={{ transform: [{ rotate: '45deg' }] }} /></View></View><View style={styles.sectionBody}>{children}</View></View>; }
function EmptyBox({ text = 'No records found' }) { return <View style={styles.emptyBox}><Text style={styles.emptyText}>{text}</Text></View>; }
function TodayFollowups({ items }) { return <Section icon="checkbox-outline" title="Today's Follow-ups" subtitle="Calls, tasks and reminders due today">{items.length ? items.map((x, i) => <ListPill key={x.id || i} title={first(x.title, x.name, x.customer, x.client, x.subject, `Follow-up ${i + 1}`)} sub={first(x.subtitle, x.time, x.date, x.next_followup, x.remarks, 'Today')} right={first(x.status, 'Open')} />) : <EmptyBox />}</Section>; }
function QueryPipeline({ items }) { const max = Math.max(1, ...items.map((x) => Number(x.value ?? x.count ?? x.total ?? 0))); return <Section icon="git-network-outline" title="Query Pipeline" subtitle="Stage-wise live query distribution">{items.length ? items.map((x, i) => { const value = Number(x.value ?? x.count ?? x.total ?? 0); return <View key={x.id || i} style={styles.pipelineRow}><View style={styles.pipelineTop}><Text style={styles.pipelineLabel}>{first(x.label, x.stage, x.name, `Stage ${i + 1}`)}</Text><Text style={styles.pipelineValue}>{num(value)}</Text></View><View style={styles.pipelineTrack}><View style={[styles.pipelineFill, { width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }]} /></View></View>; }) : <EmptyBox text="No pipeline data" />}</Section>; }
function PendingSupplierPayments({ items }) { return <Section icon="cash-outline" title="Pending Supplier Payments" subtitle="Due and unpaid supplier payables">{items.length ? items.map((x, i) => <AmountPill key={x.id || i} title={first(x.supplier, x.name, x.title, x.client, `Supplier ${i + 1}`)} sub={first(x.subtitle, `Due: ${first(x.due_date, x.date, '-')}`)} amount={x.amount ?? x.pending ?? x.balance ?? x.value} />) : <EmptyBox text="No pending supplier payments" />}</Section>; }
function UpcomingTours({ items }) { return <Section icon="airplane-outline" title="Ongoing & Upcoming Tours" subtitle="Current and upcoming confirmed tour schedule">{items.length ? items.map((x, i) => <StatusPill key={x.id || i} title={first(x.title, x.name, x.customer, x.client, `Tour ${i + 1}`)} sub={`${first(x.destination, x.city, 'Destination')} • ${first(x.from_date, x.from, x.start_date, x.date, '')}${first(x.to_date, x.to, x.end_date) ? ' - ' + first(x.to_date, x.to, x.end_date) : ''}`} status={statusText(x.status)} />) : <EmptyBox text="No ongoing or upcoming tours" />}</Section>; }
function TopDestinations({ items }) { return <Section icon="location-outline" title="Top Destinations" subtitle="Total queries and Won confirmations">{items.length ? items.slice(0, 5).map((x, i) => <DualPill key={x.id || i} title={first(x.title, x.name, x.destination, 'Not available')} total={x.total ?? x.value ?? x.count} won={x.won ?? x.confirmed ?? x.confirmed_count} />) : <EmptyBox text="No destination data" />}</Section>; }
function TeamPerformance({ items }) { return <Section icon="people-outline" title="Team Performance" subtitle="Total queries and Won confirmations user-wise">{items.length ? items.map((x, i) => <DualPill key={x.id || i} title={first(x.title, x.name, x.display_name, x.username, x.email, `Staff ${i + 1}`)} total={x.total ?? x.value ?? x.count} won={x.won ?? x.confirmed ?? x.confirmed_count} />) : <EmptyBox text="No team data" />}</Section>; }
function DestinationWeather({ items }) { return <Section icon="partly-sunny-outline" title="Destination Weather" subtitle="Selected travel cities">{items.length ? <>{items.map((w, i) => <View key={i} style={styles.weatherRow}><Text style={styles.weatherCity}>{first(w.name, w.city, w.destination)}</Text><View style={styles.weatherRight}><Ionicons name={weatherIconName(w)} size={26} color="#667085" /><Text style={styles.weatherTemp}>{first(w.temperature, w.temp, '--')}°</Text></View></View>)}<Text style={styles.weatherUpdated}>Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text></> : <EmptyBox text="No weather data" />}</Section>; }
function ListPill({ title, sub, right }) { return <View style={styles.listPill}><View style={{ flex: 1 }}><Text style={styles.listPillTitle}>{title}</Text><Text style={styles.listPillSub}>{sub}</Text></View>{right ? <Text style={styles.listPillRight}>{right}</Text> : null}</View>; }
function AmountPill({ title, sub, amount }) { return <View style={styles.listPill}><View style={{ flex: 1 }}><Text style={styles.listPillTitle}>{title}</Text><Text style={styles.listPillSub}>{sub}</Text></View><View style={styles.amountBadge}><Text style={styles.amountText}>{shortMoney(amount)}</Text></View></View>; }
function StatusPill({ title, sub, status }) { return <View style={styles.listPill}><View style={{ flex: 1 }}><Text style={styles.listPillTitle}>{title}</Text><Text style={styles.listPillSub}>{sub}</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{status}</Text></View></View>; }
function DualPill({ title, total, won }) { return <View style={styles.dualPill}><Text style={styles.dualTitle}>{title}</Text><View style={styles.dualCounts}><View style={styles.totalBubble}><Text style={styles.totalBubbleText}>{num(total)}</Text></View><View style={styles.wonBubble}><Text style={styles.wonBubbleText}>{num(won)}</Text></View></View></View>; }
function NotificationModal({ visible, onClose, dash }) { const list = dash.notifications; return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.modalShade} onPress={onClose}><View style={styles.notifyPanel}><View style={styles.panelHead}><Text style={styles.panelTitle}>Reminders</Text><Pressable onPress={onClose} style={styles.closeCircle}><Ionicons name="close" size={20} color="#667085" /></Pressable></View><View style={styles.unreadPill}><Text style={styles.unreadText}>{dash.notificationsCount} unread</Text></View><ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator>{list.length ? list.map((x, i) => <View key={x.id || i} style={styles.notifyItem}><View style={styles.notifyIcon}><Ionicons name={String(first(x.kind, x.type)).toLowerCase().includes('call') ? 'call-outline' : String(first(x.kind, x.type)).toLowerCase().includes('billing') ? 'receipt-outline' : 'calendar-outline'} size={20} color="#00A86B" /></View><View style={{ flex: 1 }}><Text style={styles.notifyTitle}>{first(x.title, x.name, x.subject, `Reminder ${i + 1}`)}</Text><View style={styles.notifyMeta}><Text style={styles.notifyKind}>{first(x.kind, x.type, 'Reminder')}</Text><Text style={styles.notifyTime}>{first(x.time_display, x.time, x.date, x.created_at)}</Text></View>{first(x.desc, x.description, x.message, x.subtitle) ? <Text style={styles.notifyDesc}>{first(x.desc, x.description, x.message, x.subtitle)}</Text> : null}</View></View>) : <EmptyBox text="No reminders" />}</ScrollView></View></Pressable></Modal>; }
function ProfileDrawer({ visible, onClose, session, dash, onLogout }) { const slide = useRef(new Animated.Value(Dimensions.get('window').width)).current; useEffect(() => { Animated.timing(slide, { toValue: visible ? 0 : Dimensions.get('window').width, duration: 230, useNativeDriver: true }).start(); }, [visible, slide]); const user = session.user || {}; const userName = first(user.name, user.display_name, session.username, 'Travbizz'); const userId = first(user.user_id, user.code, user.id, 'USR0001'); const role = first(user.role, user.profile, user.designation, 'Administrator'); const email = first(user.email, session.email, 'crm@travbizz.com'); const license = dash.license || {}; return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><View style={styles.drawerOverlay}><Pressable style={{ flex: 1 }} onPress={onClose} /><Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}><ScrollView contentContainerStyle={styles.drawerContent}><View style={styles.drawerTop}><View style={styles.profileLarge}><Text style={styles.profileLargeText}>{userName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.drawerName}>{userName}</Text><Text style={styles.drawerUserId}>User ID: {userId}</Text><Text style={styles.drawerSub}>{role} • {email}</Text><View style={styles.drawerLinks}><Text style={styles.drawerLinkBlue}>My Profile</Text><Pressable onPress={onLogout}><Text style={styles.drawerLinkRed}>Sign Out</Text></Pressable></View></View><Pressable onPress={onClose} style={styles.drawerClose}><Ionicons name="close" size={20} color="#667085" /></Pressable></View><Text style={styles.drawerSectionTitle}>My Organization</Text><View style={styles.orgRow}><View style={styles.orgIcon}><Text style={styles.orgIconText}>G</Text></View><View><Text style={styles.orgName}>{first(dash.company, session.companyName, 'Growin')}</Text><Text style={styles.orgSub}>Growin CRM</Text><Text style={styles.orgSub}>{first(session.crmUrl, session.apiBaseUrl)}</Text></View></View><Text style={styles.drawerSectionTitle}>Account</Text>{['My Profile', 'Change Password', 'Notification Settings', 'Login History'].map((x, i) => <View key={x} style={styles.accountRow}><Ionicons name={['person-outline', 'lock-closed-outline', 'notifications-outline', 'time-outline'][i]} size={18} color="#98A2B3" /><Text style={styles.accountText}>{x}</Text></View>)}<Text style={styles.drawerSectionTitle}>License</Text><View style={styles.licenseGrid}><LicenseBox label="Plan" value={first(license.plan, license.status, 'Active')} /><LicenseBox label="Valid Till" value={first(license.valid_till, license.expiry, '7 Apr 2030')} /><LicenseBox label="Users" value={first(license.users, license.max_users, '300')} /></View></ScrollView></Animated.View></View></Modal>; }
function LicenseBox({ label, value }) { return <View style={styles.licenseBox}><Text style={styles.licenseLabel}>{label}</Text><Text style={styles.licenseValue}>{value}</Text></View>; }
function DropdownModal({ visible, dropdownFor, onClose, users, chooseUser, chooseRange }) { const rangeItems = [{ key: 'today', title: 'Today' }, { key: 'week', title: 'This Week' }, { key: 'month', title: 'This Month' }, { key: 'year', title: 'This Year' }, { key: 'custom', title: 'Custom' }]; const isUser = dropdownFor === 'user'; const isRange = dropdownFor === 'range'; const list = isUser ? users : isRange ? rangeItems : [{ key: 'organization', title: 'Organization Dashboard' }]; return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.modalShade} onPress={onClose}><View style={styles.dropdownPanel}><View style={styles.panelHead}><Text style={styles.panelTitle}>{isUser ? 'Select User' : isRange ? 'Select Period' : 'Dashboard'}</Text><Pressable onPress={onClose} style={styles.closeCircle}><Ionicons name="close" size={20} color="#667085" /></Pressable></View>{list.map((x, i) => <Pressable key={x.key || x.id || i} style={styles.optionRow} onPress={() => isUser ? chooseUser(x.id || 0) : isRange ? chooseRange(x.key) : onClose()}><Text style={styles.optionText}>{first(x.title, x.name, x.display_name, 'Option')}</Text></Pressable>)}</View></Pressable></Modal>; }
function DatePickerModal({ visible, pickerFor, fromDate, toDate, setFromDate, setToDate, onClose }) { const value = pickerFor === 'from' ? parseYMD(fromDate) : parseYMD(toDate); function onChange(event, selectedDate) { if (Platform.OS !== 'ios') onClose(); if (!selectedDate) return; const ymd = formatYMD(selectedDate); if (pickerFor === 'from') setFromDate(ymd); if (pickerFor === 'to') setToDate(ymd); } return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.dateModalShade}><View style={styles.datePickerCard}><View style={styles.panelHead}><Text style={styles.panelTitle}>{pickerFor === 'from' ? 'Select From Date' : 'Select To Date'}</Text><Pressable onPress={onClose} style={styles.closeCircle}><Ionicons name="close" size={20} color="#667085" /></Pressable></View><DateTimePicker value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onChange} />{Platform.OS === 'ios' ? <Pressable style={styles.doneBtn} onPress={onClose}><Text style={styles.doneText}>Done</Text></Pressable> : null}</View></View></Modal>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF6F8' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, muted: { color: '#708093', fontWeight: '700', marginTop: 8 }, mutedSmall: { color: '#708093', fontSize: 12, fontWeight: '700' },
  loginWrap: { flexGrow: 1, padding: 24, justifyContent: 'center' }, logoCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#006D68', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, logoLetter: { color: '#fff', fontSize: 34, fontWeight: '900' }, logo: { fontSize: 36, fontWeight: '900', color: '#053B46', textAlign: 'center' }, logoSub: { fontSize: 15, fontWeight: '700', color: '#06C36B', textAlign: 'center', marginBottom: 22 }, loginCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#D8E8F0' }, loginTitle: { fontSize: 26, fontWeight: '900', color: '#03172D', textAlign: 'center' }, loginSub: { fontSize: 14, color: '#6B7688', textAlign: 'center', marginTop: 6, marginBottom: 22 }, label: { fontSize: 13, color: '#43536A', fontWeight: '800', marginBottom: 8, marginLeft: 4 }, input: { height: 54, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8E8F0', paddingHorizontal: 18, fontSize: 16, marginBottom: 15, color: '#03172D' }, passRow: { height: 54, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D8E8F0', paddingLeft: 18, paddingRight: 8, marginBottom: 15, flexDirection: 'row', alignItems: 'center' }, passInput: { flex: 1, fontSize: 16, color: '#03172D', height: '100%' }, showBtn: { paddingHorizontal: 13, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F7F1' }, showText: { color: '#069957', fontWeight: '900', fontSize: 13 }, errorText: { color: '#B42318', fontSize: 13, fontWeight: '700', lineHeight: 19 }, signBtn: { height: 56, borderRadius: 17, backgroundColor: '#06C36B', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, signText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  topBar: { backgroundColor: '#053B46', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 }, searchPill: { flex: 1, height: 36, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginRight: 8 }, searchInput: { flex: 1, fontSize: 13, color: '#03172D', marginLeft: 6 }, bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#075D63', alignItems: 'center', justifyContent: 'center', marginRight: 8 }, notifyBadge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, notifyBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' }, profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#BCEBC8', alignItems: 'center', justifyContent: 'center' }, profileText: { color: '#006D68', fontWeight: '900', fontSize: 14 },
  dashboardWrap: { padding: 2, paddingBottom: 18 }, filterHero: { backgroundColor: '#006D68', borderRadius: 16, padding: 13, margin: 2, marginBottom: 8 }, filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, gaugeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }, filterTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, filterSubtitle: { color: '#E7FFF5', fontSize: 11, fontWeight: '900', marginTop: 2, lineHeight: 16 }, dropdownWide: { height: 40, borderRadius: 12, backgroundColor: '#F8FDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, marginTop: 4 }, filterTwoCol: { flexDirection: 'row', gap: 10, marginTop: 9 }, dropdownHalf: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#F8FDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 }, dropdownText: { color: '#03172D', fontSize: 12, fontWeight: '900' }, dateHalf: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#F8FDFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }, dateBig: { color: '#03172D', fontSize: 14, fontWeight: '900' }, applyBigBtn: { height: 42, borderRadius: 12, backgroundColor: '#06C36B', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, applyBigText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  errorCard: { backgroundColor: '#FFF1F0', borderColor: '#FDA29B', borderWidth: 1, borderRadius: 16, padding: 12, marginHorizontal: 2, marginBottom: 10 }, errorStrong: { color: '#B42318', fontWeight: '900', marginBottom: 4, fontSize: 15 }, centerBlock: { padding: 22, alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: 2 }, kpiCard: { width: '48.6%', backgroundColor: '#fff', borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#D8E8F0', minHeight: 124 }, kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, kpiIconCircle: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7FFF5', alignItems: 'center', justifyContent: 'center' }, openCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#B7F3C9', alignItems: 'center', justifyContent: 'center' }, kpiTitle: { color: '#52627A', fontSize: 11, fontWeight: '900', marginBottom: 2 }, kpiValue: { color: '#03172D', fontSize: 18, fontWeight: '900', lineHeight: 24 }, kpiSub: { color: '#6B7688', fontSize: 11, fontWeight: '800', marginTop: 3 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#D8E8F0', marginTop: 10, marginHorizontal: 2, overflow: 'hidden' }, sectionHead: { padding: 13, borderBottomWidth: 1, borderBottomColor: '#EDF4F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 }, sectionIconCircle: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7FFF5', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: '#03172D', fontSize: 16, fontWeight: '900' }, sectionSubtitle: { color: '#52627A', fontSize: 10, fontWeight: '900', marginTop: 2 }, sectionOpen: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E7FFF5', alignItems: 'center', justifyContent: 'center' }, sectionBody: { paddingTop: 0, paddingBottom: 12 }, emptyBox: { marginHorizontal: 13, marginTop: 12, marginBottom: 0, minHeight: 86, borderWidth: 1, borderColor: '#D8E8F0', borderStyle: 'dashed', borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFDFF' }, emptyText: { color: '#9AA8BC', fontSize: 12, fontWeight: '900' },
  pipelineRow: { marginHorizontal: 13, marginTop: 10, padding: 12, backgroundColor: '#F8FBFD', borderRadius: 14, borderWidth: 1, borderColor: '#E7F0F5' }, pipelineTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, pipelineLabel: { color: '#03172D', fontSize: 12, fontWeight: '900', flex: 1 }, pipelineValue: { color: '#03172D', fontSize: 12, fontWeight: '900' }, pipelineTrack: { height: 7, borderRadius: 7, backgroundColor: '#E1ECF2', overflow: 'hidden' }, pipelineFill: { height: 7, borderRadius: 7, backgroundColor: '#00A86B' },
  listPill: { marginHorizontal: 13, marginTop: 10, padding: 12, backgroundColor: '#F8FBFD', borderRadius: 14, borderWidth: 1, borderColor: '#E7F0F5', flexDirection: 'row', alignItems: 'center', gap: 10 }, listPillTitle: { color: '#03172D', fontSize: 12, fontWeight: '900', lineHeight: 17 }, listPillSub: { color: '#52627A', fontSize: 10, fontWeight: '800', marginTop: 2 }, listPillRight: { color: '#00A86B', fontSize: 10, fontWeight: '900' }, amountBadge: { backgroundColor: '#DDFBEA', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }, amountText: { color: '#00875A', fontSize: 10, fontWeight: '900' }, statusBadge: { backgroundColor: '#E7FFF5', borderWidth: 1, borderColor: '#92EFC3', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }, statusText: { color: '#00875A', fontSize: 10, fontWeight: '900' },
  dualPill: { marginHorizontal: 13, marginTop: 10, minHeight: 42, backgroundColor: '#F8FBFD', borderRadius: 14, borderWidth: 1, borderColor: '#E7F0F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 }, dualTitle: { color: '#03172D', fontSize: 12, fontWeight: '900', flex: 1 }, dualCounts: { flexDirection: 'row', gap: 8 }, totalBubble: { minWidth: 30, height: 26, borderRadius: 13, backgroundColor: '#EAF6FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, totalBubbleText: { color: '#03172D', fontSize: 11, fontWeight: '900' }, wonBubble: { minWidth: 30, height: 26, borderRadius: 13, backgroundColor: '#DDFBEA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, wonBubbleText: { color: '#00875A', fontSize: 11, fontWeight: '900' },
  weatherRow: { marginHorizontal: 13, marginTop: 10, minHeight: 74, backgroundColor: '#F8FBFD', borderRadius: 14, borderWidth: 1, borderColor: '#E7F0F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 }, weatherCity: { color: '#03172D', fontSize: 12, fontWeight: '900' }, weatherRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, weatherTemp: { color: '#03172D', fontSize: 19, fontWeight: '900' }, weatherUpdated: { color: '#52627A', fontSize: 10, fontWeight: '900', textAlign: 'center', paddingVertical: 11 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', paddingTop: Platform.OS === 'ios' ? 54 : 34, paddingHorizontal: 12 }, dropdownPanel: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#D8E8F0' }, notifyPanel: { backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#D8E8F0' }, panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panelTitle: { color: '#03172D', fontSize: 17, fontWeight: '900' }, closeCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F7', alignItems: 'center', justifyContent: 'center' }, unreadPill: { alignSelf: 'flex-end', backgroundColor: '#E7FFF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginTop: 8, marginBottom: 6 }, unreadText: { color: '#00A86B', fontSize: 12, fontWeight: '900' }, notifyItem: { flexDirection: 'row', gap: 12, padding: 13, marginTop: 10, borderWidth: 1, borderColor: '#D8E8F0', borderRadius: 14, backgroundColor: '#fff' }, notifyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E7FFF5', alignItems: 'center', justifyContent: 'center' }, notifyTitle: { color: '#172033', fontSize: 14, fontWeight: '900', lineHeight: 18 }, notifyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }, notifyKind: { color: '#64748B', fontSize: 12, fontWeight: '800' }, notifyTime: { color: '#E11D48', fontSize: 12, fontWeight: '900' }, notifyDesc: { color: '#7B8794', fontSize: 12, fontWeight: '700', lineHeight: 16, marginTop: 7 }, optionRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF3F5' }, optionText: { color: '#03172D', fontSize: 14, fontWeight: '900' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', flexDirection: 'row' }, drawer: { width: '86%', backgroundColor: '#fff', height: '100%' }, drawerContent: { paddingTop: Platform.OS === 'ios' ? 48 : 22, paddingBottom: 30 }, drawerTop: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: '#F7FBFC', borderBottomWidth: 1, borderBottomColor: '#EDF2F5' }, profileLarge: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#B7F3C9', alignItems: 'center', justifyContent: 'center' }, profileLargeText: { color: '#006D68', fontSize: 22, fontWeight: '900' }, drawerName: { color: '#03172D', fontSize: 18, fontWeight: '900' }, drawerUserId: { color: '#43536A', fontSize: 12, fontWeight: '900', marginTop: 5 }, drawerSub: { color: '#708093', fontSize: 12, fontWeight: '800', marginTop: 4 }, drawerLinks: { flexDirection: 'row', gap: 18, marginTop: 11 }, drawerLinkBlue: { color: '#316DCA', fontSize: 12, fontWeight: '900' }, drawerLinkRed: { color: '#F04438', fontSize: 12, fontWeight: '900' }, drawerClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F7', alignItems: 'center', justifyContent: 'center' }, drawerSectionTitle: { color: '#344054', fontSize: 15, fontWeight: '900', marginTop: 18, marginBottom: 12, paddingHorizontal: 18 }, orgRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8, paddingHorizontal: 18 }, orgIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#CFF7F1', alignItems: 'center', justifyContent: 'center' }, orgIconText: { color: '#006D68', fontWeight: '900' }, orgName: { color: '#344054', fontSize: 14, fontWeight: '900' }, orgSub: { color: '#708093', fontSize: 12, fontWeight: '800', marginTop: 2 }, accountRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10, paddingHorizontal: 18 }, accountText: { color: '#344054', fontSize: 14, fontWeight: '700' }, licenseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 18 }, licenseBox: { width: '48%', borderWidth: 1, borderColor: '#D8E8F0', borderRadius: 10, padding: 12, minHeight: 66 }, licenseLabel: { color: '#708093', fontSize: 11, fontWeight: '900' }, licenseValue: { color: '#344054', fontSize: 15, fontWeight: '900', marginTop: 7 },
  dateModalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', padding: 18 }, datePickerCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, width: '100%', borderWidth: 1, borderColor: '#D8E8F0' }, doneBtn: { height: 44, borderRadius: 12, backgroundColor: '#06C36B', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, doneText: { color: '#fff', fontSize: 14, fontWeight: '900' }
});
