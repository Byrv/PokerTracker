import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { DbBoundary, SessionRow } from '@/lib/db/boundary';
import { assertSessionAccess } from './permission';
import { getSessionPlayerRows, paiseToInrString, reconciliation, type PlayerRow } from './data';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 8 },
  meta: { fontSize: 10, marginBottom: 4, color: '#444' },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#000',
    paddingBottom: 4,
    marginTop: 12,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: 1,
    borderColor: '#ccc',
  },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    marginTop: 4,
    borderTop: 1,
    borderColor: '#000',
    fontWeight: 'bold',
  },
  c1: { width: '30%' },
  c2: { width: '20%', textAlign: 'right' },
  c3: { width: '20%', textAlign: 'right' },
  c4: { width: '20%', textAlign: 'right' },
  footer: { marginTop: 16, fontSize: 10 },
});

function SessionDocument({
  session,
  rows,
}: {
  session: SessionRow;
  rows: PlayerRow[];
}): React.ReactElement {
  const recon = reconciliation(rows);
  const reconStatus = recon.discrepancyPaise === 0 ? 'reconciled' : 'discrepancy';
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Session Ledger</Text>
        <Text style={styles.meta}>Session ID: {session.id}</Text>
        <Text style={styles.meta}>Played on: {session.played_on}</Text>
        {session.name ? <Text style={styles.meta}>Name: {session.name}</Text> : null}
        {session.location ? <Text style={styles.meta}>Location: {session.location}</Text> : null}
        <Text style={styles.meta}>
          Blinds: {paiseToInrString(session.blinds_small)} / {paiseToInrString(session.blinds_big)}
        </Text>
        <Text style={styles.meta}>Chips per paise: {session.chips_per_paise}</Text>
        <Text style={styles.meta}>Status: {session.status}</Text>

        <View style={styles.tableHeader}>
          <Text style={styles.c1}>Player</Text>
          <Text style={styles.c2}>Buy-ins (INR)</Text>
          <Text style={styles.c3}>Cashout (INR)</Text>
          <Text style={styles.c4}>Net (INR)</Text>
        </View>

        {rows.map((r) => (
          <View key={r.userId} style={styles.row}>
            <Text style={styles.c1}>{r.nickname}</Text>
            <Text style={styles.c2}>{paiseToInrString(r.totalBuyinsPaise)}</Text>
            <Text style={styles.c3}>{paiseToInrString(r.cashoutPaise)}</Text>
            <Text style={styles.c4}>{paiseToInrString(r.netPaise)}</Text>
          </View>
        ))}

        <View style={styles.totalsRow}>
          <Text style={styles.c1}>Totals</Text>
          <Text style={styles.c2}>{paiseToInrString(recon.expectedPaise)}</Text>
          <Text style={styles.c3}>{paiseToInrString(recon.actualPaise)}</Text>
          <Text style={styles.c4}>—</Text>
        </View>

        <View style={styles.footer}>
          <Text>Reconciliation: {reconStatus}</Text>
          <Text>
            Expected: {paiseToInrString(recon.expectedPaise)} | Actual:{' '}
            {paiseToInrString(recon.actualPaise)} | Discrepancy:{' '}
            {paiseToInrString(recon.discrepancyPaise)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function exportSessionPDF(b: DbBoundary, sessionId: string): Promise<Blob> {
  await assertSessionAccess(b, sessionId);

  const session = await b.sessions.get(sessionId);
  if (!session) throw new Error('session_not_found');

  const rows = await getSessionPlayerRows(b, session);

  const blob = await pdf(<SessionDocument session={session} rows={rows} />).toBlob();
  return blob;
}
