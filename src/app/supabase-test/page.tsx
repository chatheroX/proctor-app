
'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { Database } from '@/types/supabase';

// Define a type for a student for clarity, matching the placeholder in supabase.ts
type Student = Database['public']['Tables']['students']['Row'];

export default function SupabaseTestPage() {
  const supabase = createSupabaseBrowserClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setFetchError(null);
    setStudents([]); // Clear previous results
    try {
      const { data, error: dbError } = await supabase
        .from('students')
        .select('*');

      if (dbError) {
        throw dbError;
      }
      setStudents(data || []);
    } catch (e: any) {
      console.error('Error fetching students:', e);
      setFetchError(`Failed to fetch students: ${e.message}. Ensure the 'students' table exists, has the expected columns (id, created_at, name, email), and RLS is configured if active.`);
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) {
      setError("Name and email cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Ensure the object matches the Insert type for the 'students' table
      const { error: dbError } = await supabase
        .from('students')
        .insert([{ name: newStudentName, email: newStudentEmail }]); 

      if (dbError) {
        throw dbError;
      }
      setNewStudentName('');
      setNewStudentEmail('');
      await fetchStudents(); // Refresh list after adding
    } catch (e: any)
{
      console.error('Error adding student:', e);
      setError(`Failed to add student: ${e.message}. Ensure the 'students' table exists, RLS is configured if active, and you have insert permissions. Check column names and types.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch students on initial load
  useEffect(() => {
    fetchStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return (
    <div className="container mx-auto p-4 py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Supabase Database Test Page</CardTitle>
          <CardDescription>
            Test direct database interactions (select & insert) with a hypothetical 'students' table using the 'anon' key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-md" role="alert">
            <div className="flex">
              <div className="py-1"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" /></div>
              <div>
                <p className="font-bold">Important Note for Testing:</p>
                <ul className="list-disc list-inside text-sm">
                  <li>Ensure a 'students' table exists in your Supabase public schema.</li>
                  <li>Expected columns: 'id' (uuid, primary key, default gen_random_uuid()), 'created_at' (timestamptz, default now()), 'name' (text), 'email' (text).</li>
                  <li>For these operations to succeed, especially inserts, ensure Row Level Security (RLS) is turned OFF for the 'students' table in your Supabase dashboard, OR appropriate RLS policies are in place that grant access to the 'anon' key.</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={addStudent} className="space-y-4 p-4 border rounded-md bg-background">
            <h3 className="text-lg font-medium">Add New Student</h3>
            <div>
              <Label htmlFor="studentName" className="block text-sm font-medium mb-1">Name</Label>
              <Input
                id="studentName"
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Student Name"
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="studentEmail" className="block text-sm font-medium mb-1">Email</Label>
              <Input
                id="studentEmail"
                type="email"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isLoading && !fetchError} className="w-full">
              {isLoading && !fetchError ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Student
            </Button>
          </form>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Fetched Students ({students.length})</h3>
                <Button onClick={fetchStudents} variant="outline" size="sm" disabled={isLoading && fetchError === null}>
                    {isLoading && fetchError === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh List
                </Button>
            </div>
            {fetchError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{fetchError}</p>}
            {students.length === 0 && !fetchError && !isLoading && (
              <p className="text-muted-foreground p-3 border rounded-md">No students found. Try adding one, or check your 'students' table and RLS settings.</p>
            )}
            {students.length > 0 && (
              <Textarea
                value={JSON.stringify(students, null, 2)}
                readOnly
                className="min-h-[200px] text-sm bg-muted/20 border rounded-md"
                placeholder="Fetched student data will appear here..."
              />
            )}
             {isLoading && fetchError === null && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading students...
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

