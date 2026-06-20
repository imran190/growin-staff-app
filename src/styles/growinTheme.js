import { Platform } from 'react-native';

export const growinTheme = {
  colors: {
    primary: '#14A66A',
    primaryDark: '#087548',
    mint: '#EAFBF2',
    mint2: '#F6FFF9',
    ink: '#11251C',
    muted: '#6D7F76',
    line: '#E4EEE8',
    white: '#FFFFFF',
    danger: '#DC3545',
    warning: '#F59F00',
    success: '#16A34A',
    blue: '#2563EB'
  },
  radius: {
    card: Platform.OS === 'ios' ? 24 : 18,
    input: Platform.OS === 'ios' ? 16 : 12,
    button: Platform.OS === 'ios' ? 16 : 10
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#0B4D31',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 }
    },
    android: {
      elevation: 2
    },
    default: {}
  })
};

export const isIOS = Platform.OS === 'ios';
