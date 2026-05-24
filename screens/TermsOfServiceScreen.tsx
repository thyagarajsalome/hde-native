import React from "react";
import { StyleSheet, Text, ScrollView, SafeAreaView, View } from "react-native";

export const TermsOfServiceScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.h1}>Terms of Service</Text>
        <Text style={styles.date}>Effective Date: May 24, 2026</Text>

        <Text style={styles.p}>
          Welcome to Home Design English (HDE). By accessing our website or downloading our mobile application, you agree to comply with and be bound by the following terms and conditions.
        </Text>

        <Text style={styles.h2}>1. Estimation and Budget Disclaimer</Text>
        <Text style={styles.p}>
          All calculations, material list forecasts, and estimations provided by this app are strictly reference approximations based on average Indian market rates. Construction pricing varies heavily by exact location, labor availability, season, and soil conditions.
        </Text>
        <Text style={styles.p}>
          HDE is **not** a builder, developer, contractor, or architectural firm, and takes **no liability or responsibility** for physical construction execution, budgeting overruns, structural failures, or contract disputes.
        </Text>

        <Text style={styles.h2}>2. User Accounts and Content</Text>
        <Text style={styles.p}>
          You are responsible for safeguarding your login credentials and are responsible for any activity performed under your account. We reserve the right to suspend accounts that abuse our API credits or attempt reverse engineering.
        </Text>

        <Text style={styles.h2}>3. Payments and Refund Policy</Text>
        <Text style={styles.p}>
          Pro subscriptions and calculation credits are processed securely via our web payment gateway. All payments are final, but exceptions can be requested for billing errors by contacting customer support.
        </Text>

        <Text style={styles.h2}>4. Changes to Terms</Text>
        <Text style={styles.p}>
          We reserve the right, at our sole discretion, to modify or replace these terms at any time. By continuing to access our app after those revisions become effective, you agree to be bound by the revised terms.
        </Text>

        <Text style={styles.h2}>5. Governing Law</Text>
        <Text style={styles.p}>
          These terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
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
});

export default TermsOfServiceScreen;
