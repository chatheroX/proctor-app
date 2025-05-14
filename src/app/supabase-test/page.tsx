
'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { Database } from '@/types/supabase';

// Define a type for a proctorX record
type ProctorXRecord = Database['public']['Tables']['proctorX']['Row'];

export default function SupabaseTestPage() {
  const supabase = createSupabaseBrowserClient();
  const [proctorXData, setProctorXData] = useState<ProctorXRecord[]>([]);
  const [newPassValue, setNewPassValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchProctorXTableData = async () => {
    setIsLoading(true);
    setFetchError(null);
    setProctorXData([]); 
    try {
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('*');

      if (dbError) {
        throw dbError;
      }
      setProctorXData(data || []);
    } catch (e: any) {
      console.error('Error fetching proctorX data:', e);
      setFetchError(`Failed to fetch from 'proctorX': ${e.message}. Ensure the 'proctorX' table exists, has columns (id, pass, created_at), and RLS is configured if active.`);
      setProctorXData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addProctorXRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassValue.trim()) {
      setError("'Pass' value cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('proctorX')
        .insert([{ pass: newPassValue }]); 

      if (dbError) {
        throw dbError;
      }
      setNewPassValue('');
      await fetchProctorXTableData(); // Refresh list after adding
    } catch (e: any) {
      console.error('Error adding proctorX record:', e);
      setError(`Failed to add record to 'proctorX': ${e.message}. Ensure RLS is configured if active, and you have insert permissions. Check column names and types.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on initial load
  useEffect(() => {
    fetchProctorXTableData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Supabase 'proctorX' Table Test</CardTitle>
          <CardDescription>
            Test direct database interactions (select & insert) with your 'proctorX' table using the 'anon' key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-md" role="alert">
            <div className="flex">
              <div className="py-1"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" /></div>
              <div>
                <p className="font-bold">Important Note for Testing:</p>
                <ul className="list-disc list-inside text-sm">
                  <li>Ensure a 'proctorX' table exists in your Supabase public schema.</li>
                  <li>Expected columns: 'id' (uuid, primary key, default gen_random_uuid()), 'created_at' (timestamptz, default now()), 'pass' (text).</li>
                  <li>For these operations to succeed, especially inserts, ensure Row Level Security (RLS) is turned OFF for the 'proctorX' table in your Supabase dashboard, OR appropriate RLS policies are in place that grant access to the 'anon' key.</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={addProctorXRecord} className="space-y-4 p-4 border rounded-md bg-background">
            <h3 className="text-lg font-medium">Add New Record to 'proctorX'</h3>
            <div>
              <Label htmlFor="passValue" className="block text-sm font-medium mb-1">'Pass' Column Value</Label>
              <Input
                id="passValue"
                type="text"
                value={newPassValue}
                onChange={(e) => setNewPassValue(e.target.value)}
                placeholder="Enter text for 'pass' column"
                className="w-full"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isLoading && !fetchError} className="w-full">
              {isLoading && !fetchError ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Record
            </Button>
          </form>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Fetched 'proctorX' Records ({proctorXData.length})</h3>
                <Button onClick={fetchProctorXTableData} variant="outline" size="sm" disabled={isLoading && fetchError === null}>
                    {isLoading && fetchError === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh List
                </Button>
            </div>
            {fetchError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{fetchError}</p>}
            {proctorXData.length === 0 && !fetchError && !isLoading && (
              <p className="text-muted-foreground p-3 border rounded-md">No records found in 'proctorX'. Try adding one, or check your table and RLS settings.</p>
            )}
            {proctorXData.length > 0 && (
              <Textarea
                value={JSON.stringify(proctorXData, null, 2)}
                readOnly
                className="min-h-[200px] text-sm bg-muted/20 border rounded-md"
                placeholder="Fetched 'proctorX' data will appear here..."
              />
            )}
             {isLoading && fetchError === null && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading records...
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
