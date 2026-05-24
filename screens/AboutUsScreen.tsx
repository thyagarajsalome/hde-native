import React from "react";
import { StyleSheet, Text, ScrollView, SafeAreaView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const AboutUsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="business" size={40} color="#D9A443" />
          </View>
          <Text style={styles.h1}>Home Design English (HDE)</Text>
          <Text style={styles.tagline}>Smart Cost Calculators for Indian Home Builders</Text>
        </View>

        <Text style={styles.p}>
          Home Design English (HDE) is a specialized suite of calculation engines designed to demystify home building budgets. By combining traditional building formulas with local material indexes, HDE helps homeowners and contractors estimate cost profiles for masonry, structural concrete, electrical wiring, plumbing layout, painting, and interior design.
        </Text>

        <Text style={styles.h2}>Our Mission</Text>
        <Text style={styles.p}>
          Building a house is a milestone project. Unfortunately, lack of transparent cost structures often leads to significant budget overruns. Our goal is to provide easy-to-use, data-driven calculators so you can know the quantity and approximate price of sand, cement, steel, bricks, and finishing items before breaking ground.
        </Text>

        <Text style={styles.h2}>Key Features Available</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>✓ **8 Specialized Calculators:** Structural concrete, material lists, flooring, plumbing, and more.</Text>
          <Text style={styles.bulletItem}>✓ **Vastu Shastra Guides:** Align rooms with directional compliance guidelines.</Text>
          <Text style={styles.bulletItem}>✓ **Verified Builder Directory:** Find local engineers, builders, and draftsmen in your region.</Text>
          <Text style={styles.bulletItem}>✓ **Sleek Report Sharing:** Export estimates instantly as clean, printable PDFs.</Text>
        </View>

        <Text style={styles.h2}>Support & Inquiries</Text>
        <Text style={styles.p}>
          For feedback, business inquiries, or general support issues, please contact our team at:
        </Text>
        <Text style={styles.contactEmail}>support@homedesignenglish.com</Text>
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
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  h1: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
  },
  tagline: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
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
    textAlign: "justify",
  },
  bulletList: {
    marginVertical: 8,
    paddingLeft: 4,
  },
  bulletItem: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 6,
  },
  contactEmail: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#D9A443",
    marginTop: 2,
  },
});

export default AboutUsScreen;
