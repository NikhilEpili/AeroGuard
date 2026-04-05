import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';

function resolveWebAppUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_WEB_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const hostUri =
    Constants.expoConfig?.hostUri
    || Constants.manifest2?.extra?.expoClient?.hostUri
    || Constants.manifest?.debuggerHost
    || '';

  const host = String(hostUri).split(':')[0];
  if (host) {
    return `http://${host}:5173`;
  }

  return 'http://localhost:5173';
}

export default function App() {
  const appUri = useMemo(resolveWebAppUrl, []);
  const [webError, setWebError] = useState('');

  if (webError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to load AeroGuard web app</Text>
        <Text style={styles.errorText}>Tried URL: {appUri}</Text>
        <Text style={styles.errorText}>Ensure the frontend is running with npm run dev in the frontend folder.</Text>
        <Text style={styles.errorText}>If needed, set EXPO_PUBLIC_WEB_URL to your reachable frontend URL.</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView 
        source={{ uri: appUri }}
        style={styles.webview} 
        originWhitelist={['*']}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loaderText}>Loading AeroGuard...</Text>
          </View>
        )}
        onHttpError={(event) => {
          setWebError(`HTTP ${event.nativeEvent.statusCode}`);
        }}
        onError={() => {
          setWebError('Network error');
        }}
        showsVerticalScrollIndicator={false}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // Adds padding to ensure the website doesn't hide behind the notch or status bar
    paddingTop: Constants.statusBarHeight,
  },
  webview: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  loaderText: {
    color: '#334155',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: Constants.statusBarHeight,
    gap: 10,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  errorText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
