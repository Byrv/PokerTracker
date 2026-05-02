'use client';

import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SessionTabs({
  ledger,
  notes,
  photos,
  audit,
}: {
  ledger: ReactNode;
  notes: ReactNode;
  photos: ReactNode;
  audit: ReactNode;
}) {
  return (
    <Tabs defaultValue="ledger" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="ledger">Ledger</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>
      <TabsContent value="ledger" className="space-y-4 pt-3">
        {ledger}
      </TabsContent>
      <TabsContent value="notes" className="space-y-3 pt-3">
        {notes}
      </TabsContent>
      <TabsContent value="photos" className="pt-3">
        {photos}
      </TabsContent>
      <TabsContent value="audit" className="pt-3">
        {audit}
      </TabsContent>
    </Tabs>
  );
}
