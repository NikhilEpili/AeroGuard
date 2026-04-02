import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

export default function App() {
  // IMPORTANT: For local development, change this to your computer's local IP address (e.g. 'http://192.168.1.100:5173')
  // Automatically found Wi-Fi IPv4 address for your machine:
  const appUri = 'http://10.95.144.220:5173';

  return (
    <View style={styles.container}>
      <WebView 
        source={{ uri: appUri }} 
        style={styles.webview} 
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
});
