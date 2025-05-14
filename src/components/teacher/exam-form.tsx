'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Upload, Brain, Save, FileText, Settings2, CalendarDays, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string; // Could be index or value
}

interface ExamData {
  id?: string;
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Question[];
  // Add section-wise settings if needed
}

interface ExamFormProps {
  initialData?: ExamData;
  onSave: (data: ExamData) => Promise<void>;
  isEditing?: boolean;
}

export function ExamForm({ initialData, onSave, isEditing = false }: ExamFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [duration, setDuration] = useState(initialData?.duration || 60);
  const [allowBacktracking, setAllowBacktracking] = useState(initialData?.allowBacktracking !== undefined ? initialData.allowBacktracking : true);
  const [questions, setQuestions] = useState<Question[]>(initialData?.questions || []);
  
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState(['', '', '', '']);
  const [currentCorrectAnswer, setCurrentCorrectAnswer] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleAddQuestion = () => {
    if (!currentQuestionText.trim() || !currentCorrectAnswer.trim() || currentOptions.some(opt => !opt.trim())) {
      toast({ title: "Incomplete Question", description: "Please fill all fields for the question.", variant: "destructive" });
      return;
    }
    const newQuestion: Question = {
      id: `q-${Date.now()}`, // Simple unique ID
      text: currentQuestionText,
      options: [...currentOptions],
      correctAnswer: currentCorrectAnswer,
    };
    setQuestions([...questions, newQuestion]);
    // Reset fields
    setCurrentQuestionText('');
    setCurrentOptions(['', '', '', '']);
    setCurrentCorrectAnswer('');
    toast({ description: "Question added." });
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    toast({ description: "Question removed." });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    setCurrentOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const examData: ExamData = {
      id: initialData?.id,
      title,
      description,
      duration,
      allowBacktracking,
      questions,
    };
    try {
      await onSave(examData);
      toast({ title: "Success!", description: `Exam ${isEditing ? 'updated' : 'created'} successfully.` });
      router.push('/teacher/dashboard/exams'); // Redirect after save
    } catch (error) {
      toast({ title: "Error", description: "Failed to save exam. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{isEditing ? 'Edit Exam' : 'Create New Exam'}</CardTitle>
          <CardDescription>
            {isEditing ? 'Modify the details of your existing exam.' : 'Fill in the details to create a new exam.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Basic Info Section */}
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

          {/* Settings Section */}
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
             <div className="space-y-2"> {/* Placeholder for timing/scheduling */}
                <Label className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/> Scheduling (Coming Soon)</Label>
                <p className="text-sm text-muted-foreground">Set start and end dates/times for the exam.</p>
                <Input type="datetime-local" disabled className="w-full md:w-1/2" />
            </div>
          </section>

          {/* Questions Section */}
          <section className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-lg font-medium">Manage Questions ({questions.length} added)</h3>
            
            {/* Question Upload Options */}
            <div className="flex flex-wrap gap-2 my-4">
              <Button type="button" variant="outline" disabled>
                <Upload className="mr-2 h-4 w-4" /> Upload CSV (Soon)
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/teacher/dashboard/ai-assistant" target="_blank"> {/* Open in new tab to not lose form state */}
                  <Brain className="mr-2 h-4 w-4" /> Use AI Assistant
                </Link>
              </Button>
            </div>

            {/* Manual Question Input */}
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-md">Add New Question Manually</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="questionText">Question Text</Label>
                  <Textarea id="questionText" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} placeholder="Enter the question" />
                </div>
                {currentOptions.map((opt, index) => (
                  <div className="space-y-1" key={index}>
                    <Label htmlFor={`option${index + 1}`}>Option {index + 1}</Label>
                    <Input id={`option${index + 1}`} value={opt} onChange={(e) => handleOptionChange(index, e.target.value)} placeholder={`Option ${index + 1}`} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label htmlFor="correctAnswer">Correct Answer (Enter exact text of one option)</Label>
                  <Input id="correctAnswer" value={currentCorrectAnswer} onChange={(e) => setCurrentCorrectAnswer(e.target.value)} placeholder="e.g., Option 1 text" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={handleAddQuestion} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add This Question
                </Button>
              </CardFooter>
            </Card>

            {/* Display Added Questions */}
            {questions.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold">Added Questions:</h4>
                <ul className="space-y-2">
                  {questions.map((q, index) => (
                    <li key={q.id} className="p-3 border rounded-md bg-background flex justify-between items-start">
                      <div>
                        <p className="font-medium">{index + 1}. {q.text}</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground pl-4">
                          {q.options.map((opt, i) => (
                            <li key={i} className={opt === q.correctAnswer ? 'text-green-600 font-semibold' : ''}>{opt}</li>
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
            {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : <><Save className="mr-2 h-4 w-4" /> {isEditing ? 'Save Changes' : 'Create Exam'}</>}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
