import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import BottomTabs from './src/components/BottomTabs';
import { growinTheme } from './src/styles/growinTheme';

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={growinTheme.colors.mint2} />
        <LoginScreen onLogin={setSession} />
      </>
    );
  }

  let screen = <DashboardScreen session={session} onLogout={() => setSession(null)} />;
  if (activeTab === 'queries') screen = <PlaceholderScreen title="Queries" />;
  if (activeTab === 'whatsapp') screen = <PlaceholderScreen title="WhatsApp" />;
  if (activeTab === 'settings') screen = <PlaceholderScreen title="More" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={growinTheme.colors.mint2} />
      {screen}
      <BottomTabs active={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: growinTheme.colors.mint2,
    paddingTop: Platform.OS === 'android' ? 0 : 0
  }
});


export default App;
registerRootComponent(App);
