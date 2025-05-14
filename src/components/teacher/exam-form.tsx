
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Trash2, Upload, Brain, Save, FileText, Settings2, CalendarDays, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from "@/lib/utils"; // Added this import

interface QuestionOption {
  id: string;
  text: string;
}
interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
}

interface ExamData {
  id?: string; // This would be the exam's unique ID if editing
  user_id?: string; // Teacher's user_id who created the exam
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Question[];
  exam_code?: string; // Will be auto-generated on actual save
  status?: 'Draft' | 'Published' | 'Ongoing' | 'Completed'; // Default to Draft
  created_at?: string;
}

interface ExamFormProps {
  initialData?: ExamData;
  onSave: (data: ExamData) => Promise<{success: boolean, error?: string, examId?: string}>; // Updated to reflect potential return
  isEditing?: boolean;
}

export function ExamForm({ initialData, onSave, isEditing = false }: ExamFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [duration, setDuration] = useState(initialData?.duration || 60);
  const [allowBacktracking, setAllowBacktracking] = useState(initialData?.allowBacktracking !== undefined ? initialData.allowBacktracking : true);

  const initializeQuestions = (initialQs?: Question[]): Question[] => {
    if (!initialQs) return [];
    return initialQs.map(q => ({
      ...q,
      options: q.options.map(opt => ({ ...opt })), // Ensure options have unique IDs if needed
    }));
  };
  const [questions, setQuestions] = useState<Question[]>(initializeQuestions(initialData?.questions));

  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<QuestionOption[]>([
    { id: `opt-0-${Date.now()}`, text: '' }, { id: `opt-1-${Date.now() + 1}`, text: '' }, { id: `opt-2-${Date.now() + 2}`, text: '' }, { id: `opt-3-${Date.now() + 3}`, text: '' }
  ]);
  const [currentCorrectOptionId, setCurrentCorrectOptionId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

  const resetOptionIdsAndText = () => {
    return [
      { id: `opt-0-${Date.now()}`, text: '' }, 
      { id: `opt-1-${Date.now() + 1}`, text: '' }, 
      { id: `opt-2-${Date.now() + 2}`, text: '' }, 
      { id: `opt-3-${Date.now() + 3}`, text: '' }
    ];
  };

  const handleAddQuestion = () => {
    if (!currentQuestionText.trim() || currentOptions.some(opt => !opt.text.trim())) {
      toast({ title: "Incomplete Question", description: "Please fill in the question text and all option fields.", variant: "destructive" });
      return;
    }
    if (!currentCorrectOptionId) {
        toast({ title: "No Correct Answer", description: "Please select a correct answer for the question.", variant: "destructive" });
        return;
    }
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      text: currentQuestionText,
      options: currentOptions.map(opt => ({ ...opt, id: `opt-${Math.random().toString(36).substring(2, 9)}-${Date.now()}` })), // Ensure fresh IDs for options
      correctOptionId: currentCorrectOptionId,
    };
    setQuestions([...questions, newQuestion]);
    setCurrentQuestionText('');
    setCurrentOptions(resetOptionIdsAndText());
    setCurrentCorrectOptionId('');
    toast({ description: "Question added to list below." });
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    toast({ description: "Question removed." });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentOptions];
    newOptions[index] = { ...newOptions[index], text: value };
    setCurrentOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
        toast({title: "Missing Title", description: "Exam title is required.", variant: "destructive"});
        return;
    }
    if (questions.length === 0) {
        toast({title: "No Questions", description: "Please add at least one question to the exam.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    const examData: ExamData = {
      id: initialData?.id,
      title,
      description,
      duration,
      allowBacktracking,
      questions,
      // user_id, status, exam_code, created_at would be set by backend/onSave typically
    };
    
    // SIMULATED SAVE - Replace with actual save logic
    console.log("Attempting to save exam (UI only):", examData);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    // const result = await onSave(examData); // Real save function call
    const result = {success: true, examId: initialData?.id || `temp-id-${Date.now()}`}; // Mock result for UI flow

    if (result.success) {
      toast({ title: "Success!", description: `Exam ${isEditing ? 'updated' : 'prepared'} (UI only). Backend saving not implemented.` });
      // router.push(isEditing && result.examId ? `/teacher/dashboard/exams/${result.examId}/details` : '/teacher/dashboard/exams');
      if (isEditing && result.examId) {
        router.push(`/teacher/dashboard/exams/${result.examId}/details`);
      } else if (!isEditing) {
        // For new exams, maybe go to list or a temporary success page
        router.push('/teacher/dashboard/exams'); 
        // Or if an ID is returned from a real save: router.push(`/teacher/dashboard/exams/${result.examId}/details`);
      } else {
        router.push('/teacher/dashboard/exams');
      }
    } else {
      toast({ title: "Error", description: result.error || "Failed to save exam. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{isEditing ? 'Edit Exam' : 'Create New Exam'}</CardTitle>
          <CardDescription>
            {isEditing ? 'Modify the details of your existing exam.' : 'Fill in the details to create a new exam. Note: Exam saving to database is not yet implemented.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-lg font-medium flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/> Basic Information</h3>
            <div className="space-y-2">
              <Label htmlFor="examTitle">Exam Title</Label>
              <Input id="examTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Final Year Mathematics" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examDescription">Description (Optional)</Label>
              <Textarea id="examDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief overview of the exam content and instructions." />
            </div>
          </section>

          <section className="space-y-4 p-4 border rounded-lg">
             <h3 className="text-lg font-medium flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary"/> Exam Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="examDuration" className="flex items-center gap-1"><Clock className="h-4 w-4"/> Duration (minutes)</Label>
                <Input id="examDuration" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} min="10" required />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                    <Switch id="allowBacktracking" checked={allowBacktracking} onCheckedChange={setAllowBacktracking} />
                    <Label htmlFor="allowBacktracking">Allow Backtracking</Label>
                </div>
            </div>
             <div className="space-y-2">
                <Label className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/> Scheduling (Coming Soon)</Label>
                <p className="text-sm text-muted-foreground">Set start and end dates/times for the exam.</p>
                <Input type="datetime-local" disabled className="w-full md:w-1/2" />
            </div>
          </section>

          <section className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-lg font-medium">Manage Questions ({questions.length} added)</h3>

            <div className="flex flex-wrap gap-2 my-4">
              <Button type="button" variant="outline" disabled>
                <Upload className="mr-2 h-4 w-4" /> Upload CSV (Soon)
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/teacher/dashboard/ai-assistant" target="_blank">
                  <Brain className="mr-2 h-4 w-4" /> Use AI Assistant
                </Link>
              </Button>
            </div>

            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-md">Add New Question Manually</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="questionText">Question Text</Label>
                  <Textarea id="questionText" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} placeholder="Enter the question" />
                </div>
                <div>
                  <Label>Options & Correct Answer</Label>
                  <RadioGroup value={currentCorrectOptionId} onValueChange={setCurrentCorrectOptionId} className="mt-2 space-y-2">
                    {currentOptions.map((opt, index) => (
                      <div key={opt.id} className="flex items-center gap-2 p-2 border rounded-md bg-background hover:bg-accent/50 has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary">
                        <RadioGroupItem value={opt.id} id={opt.id} />
                        <Label htmlFor={opt.id} className="sr-only">Select Option {index + 1} as correct</Label>
                        <Input
                          value={opt.text}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="flex-grow"
                        />
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={handleAddQuestion} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add This Question
                </Button>
              </CardFooter>
            </Card>

            {questions.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold">Added Questions:</h4>
                <ul className="space-y-2">
                  {questions.map((q, index) => (
                    <li key={q.id} className="p-3 border rounded-md bg-background flex justify-between items-start">
                      <div>
                        <p className="font-medium">{index + 1}. {q.text}</p>
                        <ul className="list-none text-sm text-muted-foreground pl-4 space-y-1">
                          {q.options.map((opt) => (
                            <li key={opt.id} className={cn("flex items-center gap-2", opt.id === q.correctOptionId ? 'text-green-600 font-semibold' : '')}>
                              {opt.id === q.correctOptionId && <CheckCircle className="h-4 w-4 text-green-600" />}
                              <span>{opt.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuestion(q.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
           <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isLoading ? (isEditing ? 'Saving...' : 'Preparing...') : (isEditing ? 'Save Changes' : 'Prepare Exam (UI Only)')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
