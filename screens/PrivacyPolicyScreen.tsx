import React from "react";
import { StyleSheet, Text, ScrollView, SafeAreaView, View } from "react-native";

export const PrivacyPolicyScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.h1}>Privacy Policy</Text>
        <Text style={styles.date}>Effective Date: May 24, 2026</Text>

        <Text style={styles.p}>
          At Home Design English (HDE), accessible from our website and mobile application, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by HDE and how we use it.
        </Text>

        <Text style={styles.h2}>1. Information We Collect</Text>
        <Text style={styles.p}>
          We collect personal data that you provide to us, such as email address and profile preferences when you create an account. If you make inputs into our calculators, those details (like area, materials chosen, and pricing factors) may be stored in your dashboard if you choose to save the project.
        </Text>

        <Text style={styles.h2}>2. How We Use Your Information</Text>
        <Text style={styles.p}>
          We use the information we collect in various ways, including to:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Provide, operate, and maintain our mobile calculators and galleries.</Text>
          <Text style={styles.bulletItem}>• Improve, personalize, and expand our services.</Text>
          <Text style={styles.bulletItem}>• Understand and analyze how you use our mobile app.</Text>
          <Text style={styles.bulletItem}>• Develop new products, services, features, and functionality.</Text>
          <Text style={styles.bulletItem}>• Communicate with you, either directly or through one of our partners, for customer service, updates, and other information relating to the app.</Text>
        </View>

        <Text style={styles.h2}>3. Log Files and Local Storage</Text>
        <Text style={styles.p}>
          Our app registers standard crash logs and user session states locally on your device via AsyncStorage to keep you signed in. This data is not shared with third-party tracking services.
        </Text>

        <Text style={styles.h2}>4. Third-Party Integrations</Text>
        <Text style={styles.p}>
          We use Supabase as our primary backend provider for authentication and storage. All session information and saved projects are stored on their secure servers.
        </Text>

        <Text style={styles.h2}>5. Contact Us</Text>
        <Text style={styles.p}>
          If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at support@homedesignenglish.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    padding: 20,
  },
  h1: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
  h2: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginTop: 18,
    marginBottom: 8,
  },
  p: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    marginVertical: 8,
    paddingLeft: 8,
  },
  bulletItem: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 6,
  },
});

export default PrivacyPolicyScreen;
