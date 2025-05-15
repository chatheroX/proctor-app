// This page is being neutralized as per the request to remove teacher demo features.
// The actual exam taking flow for students is now via /student/dashboard/exam/[examId]/initiate -> /take
'use client';

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function TeacherDemoExamPage() {
    const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl">Demo Feature Removed</CardTitle>
        </CardHeader>
        <CardContent>
            <CardDescription>
                The teacher demo test feature has been removed. Student exam flow is now managed through their dashboard.
            </CardDescription>
        </CardContent>
        <CardFooter>
            <Button onClick={() => router.back()} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
