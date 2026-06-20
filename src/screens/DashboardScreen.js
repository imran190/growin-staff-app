import React from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { growinTheme, isIOS } from '../styles/growinTheme';

const stats = [
  { label: 'New Queries', value: '18', tone: 'primary' },
  { label: 'Follow-ups', value: '07', tone: 'warning' },
  { label: 'Confirmed', value: '05', tone: 'success' },
  { label: 'Due Payments', value: '₹82K', tone: 'blue' }
];

const quick = ['Add Query', 'Query List', 'Itinerary', 'WhatsApp'];
const today = [
  { title: 'Call Rahul Sharma', meta: 'Goa query • 11:30 AM' },
  { title: 'Send quotation', meta: 'Dubai package • Pending' },
  { title: 'Payment follow-up', meta: 'Invoice #INV-104 • ₹18,500' }
];

function toneColor(tone) {
  if (tone === 'warning') return growinTheme.colors.warning;
  if (tone === 'success') return growinTheme.colors.success;
  if (tone === 'blue') return growinTheme.colors.blue;
  return growinTheme.colors.primary;
}

export default function DashboardScreen({ session, onLogout }) {
  const userName = session?.user?.name || 'Staff User';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello, {userName}</Text>
            <Text style={styles.company}>{session?.companyName || 'Growin CRM'}</Text>
          </View>
          <Pressable onPress={onLogout} style={styles.logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Today Overview</Text>
          <Text style={styles.cardSub}>Simple dashboard, no extra clutter.</Text>
          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statBox}>
                <Text style={[styles.statValue, { color: toneColor(item.tone) }]}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {quick.map((item) => (
            <Pressable key={item} style={styles.quickButton}>
              <Text style={styles.quickText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Today Tasks</Text>
        <View style={styles.listCard}>
          {today.map((item, index) => (
            <View key={item.title} style={[styles.taskRow, index !== today.length - 1 && styles.taskBorder]}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskMeta}>{item.meta}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: growinTheme.colors.mint2 },
  scroll: { padding: 18, paddingTop: Platform.OS === 'android' ? 44 : 12, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  hello: { fontSize: 25, fontWeight: isIOS ? '800' : '900', color: growinTheme.colors.ink, letterSpacing: -0.3 },
  company: { marginTop: 4, color: growinTheme.colors.muted, fontSize: 13 },
  logout: {
    paddingHorizontal: 13,
    height: 36,
    borderRadius: isIOS ? 18 : 10,
    backgroundColor: growinTheme.colors.white,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutText: { color: growinTheme.colors.primaryDark, fontWeight: '700' },
  summaryCard: {
    backgroundColor: growinTheme.colors.white,
    borderRadius: growinTheme.radius.card,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    padding: 17,
    ...growinTheme.shadow
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: growinTheme.colors.ink },
  cardSub: { color: growinTheme.colors.muted, marginTop: 4, fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statBox: {
    width: '47.8%',
    backgroundColor: growinTheme.colors.mint2,
    borderRadius: isIOS ? 18 : 14,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    padding: 14
  },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { marginTop: 5, color: growinTheme.colors.muted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 16, fontWeight: '800', color: growinTheme.colors.ink },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickButton: {
    width: '47.8%',
    height: 50,
    borderRadius: growinTheme.radius.button,
    backgroundColor: growinTheme.colors.white,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickText: { color: growinTheme.colors.primaryDark, fontWeight: '800' },
  listCard: {
    backgroundColor: growinTheme.colors.white,
    borderRadius: growinTheme.radius.card,
    borderWidth: 1,
    borderColor: growinTheme.colors.line,
    overflow: 'hidden'
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  taskBorder: { borderBottomWidth: 1, borderBottomColor: growinTheme.colors.line },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: growinTheme.colors.primary },
  taskTitle: { color: growinTheme.colors.ink, fontWeight: '800', fontSize: 14 },
  taskMeta: { color: growinTheme.colors.muted, marginTop: 3, fontSize: 12 }
});
