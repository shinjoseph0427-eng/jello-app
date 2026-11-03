import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Section = { title: string; paragraphs: string[] };

export function LegalPage({ title, summary, sections }: { title: string; summary: string; sections: Section[] }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.shell}>
    <View style={styles.nav}><Link href="/" style={styles.brand}>JELLO</Link><View style={styles.links}><Link href="/privacy" style={styles.navLink}>Privacy</Link><Link href="/terms" style={styles.navLink}>Terms</Link></View></View>
    <View style={styles.hero}><Text style={styles.title}>{title}</Text><Text style={styles.summary}>{summary}</Text><Text style={styles.updated}>Effective November 2, 2026</Text></View>
    <View style={styles.document}>{sections.map((section) => <View key={section.title} style={styles.section}><Text style={styles.sectionTitle}>{section.title}</Text>{section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}</View>)}</View>
    <View style={styles.footer}><Text style={styles.footerText}>Jello — Two people. Two moments. One photo.</Text><Text style={styles.footerText}>Questions: support@jello.app</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFDF8' },
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 72 },
  nav: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E9E1D2' },
  brand: { color: '#F3A621', fontSize: 24, fontWeight: '900', letterSpacing: -1.5, textDecorationLine: 'none' },
  links: { flexDirection: 'row', gap: 22 }, navLink: { color: '#4D4335', fontSize: 14, fontWeight: '700', textDecorationLine: 'none' },
  hero: { paddingTop: 74, paddingBottom: 54, borderBottomWidth: 1, borderBottomColor: '#E9E1D2' },
  title: { color: '#201A13', fontSize: 48, lineHeight: 54, letterSpacing: -2.2, fontWeight: '900', maxWidth: 700 },
  summary: { color: '#675B4B', fontSize: 19, lineHeight: 29, maxWidth: 660, marginTop: 18 },
  updated: { color: '#8A7D6A', fontSize: 13, marginTop: 24 },
  document: { paddingTop: 30 }, section: { paddingVertical: 27, borderBottomWidth: 1, borderBottomColor: '#EEE7DB' },
  sectionTitle: { color: '#201A13', fontSize: 23, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  body: { color: '#51483C', fontSize: 16, lineHeight: 26, maxWidth: 730, marginBottom: 10 },
  footer: { paddingTop: 34, gap: 6 }, footerText: { color: '#8A7D6A', fontSize: 13 },
});
