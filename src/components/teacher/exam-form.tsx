
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, Trash2, Upload, Brain, Save, FileText, Settings2, CalendarDays, Clock, CheckCircle, Loader2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import type { Question, QuestionOption, Exam } from '@/types/supabase';
import { format, parseISO } from 'date-fns';


// ExamData for the form, matching parts of the Exam type
export interface ExamFormData {
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Question[];
  startTime: Date | null;
  endTime: Date | null;
  exam_id?: string;
  exam_code?: string;
  status?: Exam['status'];
}

interface ExamFormProps {
  initialData?: ExamFormData;
  onSave: (data: ExamFormData) => Promise<{ success: boolean; error?: string; examId?: string }>;
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

  const [startTime, setStartTime] = useState<Date | null>(initialData?.startTime ? (typeof initialData.startTime === 'string' ? parseISO(initialData.startTime) : initialData.startTime) : null);
  const [endTime, setEndTime] = useState<Date | null>(initialData?.endTime ? (typeof initialData.endTime === 'string' ? parseISO(initialData.endTime) : initialData.endTime) : null);
  const [startTimeStr, setStartTimeStr] = useState(initialData?.startTime ? format(typeof initialData.startTime === 'string' ? parseISO(initialData.startTime) : initialData.startTime, "HH:mm") : "00:00");
  const [endTimeStr, setEndTimeStr] = useState(initialData?.endTime ? format(typeof initialData.endTime === 'string' ? parseISO(initialData.endTime) : initialData.endTime, "HH:mm") : "00:00");


  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<QuestionOption[]>([
    { id: `opt-0-${Date.now()}`, text: '' }, { id: `opt-1-${Date.now() + 1}`, text: '' }, { id: `opt-2-${Date.now() + 2}`, text: '' }, { id: `opt-3-${Date.now() + 3}`, text: '' }
  ]);
  const [currentCorrectOptionId, setCurrentCorrectOptionId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setDuration(initialData.duration || 60);
        setAllowBacktracking(initialData.allowBacktracking !== undefined ? initialData.allowBacktracking : true);
        setQuestions(initialData.questions || []);
        
        const initialStartTime = initialData.startTime ? (typeof initialData.startTime === 'string' ? parseISO(initialData.startTime) : initialData.startTime) : null;
        const initialEndTime = initialData.endTime ? (typeof initialData.endTime === 'string' ? parseISO(initialData.endTime) : initialData.endTime) : null;

        setStartTime(initialStartTime);
        setEndTime(initialEndTime);
        setStartTimeStr(initialStartTime ? format(initialStartTime, "HH:mm") : "00:00");
        setEndTimeStr(initialEndTime ? format(initialEndTime, "HH:mm") : "00:00");
    }
  }, [initialData]);

  const handleDateChange = (date: Date | undefined, type: 'start' | 'end') => {
    if (!date) {
        if (type === 'start') setStartTime(null);
        else setEndTime(null);
        return;
    }

    const timeStr = type === 'start' ? startTimeStr : endTimeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    const newDateTime = new Date(date);
    newDateTime.setHours(hours, minutes, 0, 0);

    if (type === 'start') {
        setStartTime(newDateTime);
    } else {
        setEndTime(newDateTime);
    }
  };

  const handleTimeChange = (timeValue: string, type: 'start' | 'end') => {
    const currentDate = type === 'start' ? startTime : endTime;
    if (type === 'start') setStartTimeStr(timeValue);
    else setEndTimeStr(timeValue);

    if (currentDate) {
        const [hours, minutes] = timeValue.split(':').map(Number);
        const newDateTime = new Date(currentDate);
        newDateTime.setHours(hours, minutes, 0, 0);
        if (type === 'start') setStartTime(newDateTime);
        else setEndTime(newDateTime);
    }
  };


  const resetOptionIdsAndText = (): QuestionOption[] => {
    return Array.from({ length: 4 }, (_, i) => ({ id: `opt-${i}-${Date.now() + i}`, text: '' }));
  };

  const handleAddQuestion = () => {
    if (!currentQuestionText.trim()) {
      toast({ title: "Incomplete Question", description: "Please fill in the question text.", variant: "destructive" });
      return;
    }
    const filledOptions = currentOptions.filter(opt => opt.text.trim() !== '');
    if (filledOptions.length < 2) {
      toast({ title: "Not Enough Options", description: "Please provide at least two options.", variant: "destructive" });
      return;
    }
    if (!currentCorrectOptionId || !filledOptions.find(opt => opt.id === currentCorrectOptionId)) {
      toast({ title: "No Correct Answer", description: "Please select a valid correct answer from the provided options.", variant: "destructive" });
      return;
    }

    const newQuestion: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: currentQuestionText,
      options: filledOptions.map(opt => ({ ...opt, id: `opt-${Math.random().toString(36).substring(2, 9)}-${Date.now()}` })), // Ensure new IDs for options when added to question
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
      toast({ title: "Missing Title", description: "Exam title is required.", variant: "destructive" });
      return;
    }
    if (duration <= 0) {
      toast({ title: "Invalid Duration", description: "Duration must be greater than 0 minutes.", variant: "destructive" });
      return;
    }
     if (startTime && endTime && startTime >= endTime) {
      toast({ title: "Invalid Dates", description: "Start time must be before end time.", variant: "destructive" });
      return;
    }
    // Questions are optional for draft, but might be required for publishing later
    // if (questions.length === 0 && !isEditing) {
    //   toast({ title: "No Questions", description: "Please add at least one question to the exam.", variant: "destructive" });
    //   return;
    // }

    setIsLoading(true);
    const examFormData: ExamFormData = {
      exam_id: initialData?.exam_id,
      title,
      description,
      duration,
      allowBacktracking,
      questions,
      startTime,
      endTime,
      exam_code: initialData?.exam_code,
      status: initialData?.status || 'Draft' // Default to Draft if not editing an existing status
    };

    const result = await onSave(examFormData);

    if (result.success && result.examId) {
      toast({ title: "Success!", description: `Exam ${isEditing ? 'updated' : 'created'} successfully.` });
      router.push(`/teacher/dashboard/exams/${result.examId}/details`);
    } else {
      toast({ title: "Error", description: result.error || `Failed to ${isEditing ? 'update' : 'create'} exam. Please try again.`, variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">{isEditing ? `Edit Exam: ${initialData?.title || ''}` : 'Create New Exam'}</CardTitle>
          <CardDescription>
            {isEditing ? 'Modify the details of your existing exam.' : 'Fill in the details to create a new exam.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-lg font-medium flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Basic Information</h3>
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
            <h3 className="text-lg font-medium flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Exam Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="examDuration" className="flex items-center gap-1"><Clock className="h-4 w-4" /> Duration (minutes)</Label>
                <Input id="examDuration" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} min="1" required />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch id="allowBacktracking" checked={allowBacktracking} onCheckedChange={setAllowBacktracking} />
                <Label htmlFor="allowBacktracking">Allow Backtracking</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Scheduling</Label>
              <p className="text-sm text-muted-foreground">Set start and end dates/times for the exam. (Optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="startTimeDate">Start Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startTime && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startTime ? format(startTime, "PPP") : <span>Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startTime ?? undefined}
                          onSelect={(date) => handleDateChange(date, 'start')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input 
                        type="time" 
                        value={startTimeStr}
                        onChange={(e) => handleTimeChange(e.target.value, 'start')}
                        className="w-[120px]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endTimeDate">End Date & Time</Label>
                   <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endTime && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endTime ? format(endTime, "PPP") : <span>Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endTime ?? undefined}
                          onSelect={(date) => handleDateChange(date, 'end')}
                          initialFocus
                          disabled={(date) => startTime ? date < startTime : false}
                        />
                      </PopoverContent>
                    </Popover>
                     <Input 
                        type="time" 
                        value={endTimeStr}
                        onChange={(e) => handleTimeChange(e.target.value, 'end')}
                        className="w-[120px]"
                    />
                  </div>
                </div>
              </div>
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
                  <Label>Options & Correct Answer (Provide at least 2 options)</Label>
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
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
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
            {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Exam')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
