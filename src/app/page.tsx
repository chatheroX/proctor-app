
import React from 'react';
import { AppHeader } from '@/components/shared/header';
import { AppFooter } from '@/components/shared/footer';
import { ThreeScenePlaceholder } from '@/components/landing/three-scene-placeholder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, BookOpenText, Users, Cpu, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: <CheckCircle className="h-10 w-10 text-primary" />,
    title: 'Secure Exam Environment',
    description: 'Tight integration with Safe Exam Browser (SEB) for cheat-proof online exams.',
  },
  {
    icon: <BookOpenText className="h-10 w-10 text-primary" />,
    title: 'Flexible Exam Management',
    description: 'Full CRUD for exams, diverse question upload options, and customizable settings for teachers.',
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: 'Role-Based Dashboards',
    description: 'Dedicated, intuitive dashboards for both students and teachers.',
  },
  {
    icon: <Cpu className="h-10 w-10 text-primary" />,
    title: 'AI-Powered Assistance',
    description: 'Built-in AI assistant to help teachers generate diverse exam questions effortlessly.',
  },
];

export default function LandingPage() {
  return (
    // TODO: Add Framer Motion wrapper here for page transitions if desired
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-muted/30 to-background">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
           {/* Background decorative gradients or shapes */}
          <div aria-hidden="true" className="absolute inset-0 grid grid-cols-2 -space-x-52 opacity-40 dark:opacity-20">
            <div className="blur-[106px] h-56 bg-gradient-to-br from-primary to-purple-400 dark:from-primary/70 dark:to-purple-600"></div>
            <div className="blur-[106px] h-32 bg-gradient-to-r from-cyan-400 to-sky-300 dark:from-cyan-400/70 dark:to-sky-300/70"></div>
          </div>
          <div className="container px-4 md:px-6 relative">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div className="space-y-8">
                {/* TODO: Add Framer Motion to h1 and p for staggered entrance */}
                <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl !leading-tight">
                  The Future of <span className="text-primary block">Secure Online</span> Proctoring
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  ProctorPrep offers a robust, modern platform for conducting secure online exams, trusted by educators and students alike.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* TODO: Add Framer Motion to buttons for hover/tap effects */}
                  <Button size="lg" className="shadow-lg hover:shadow-primary/40 transition-shadow duration-300" asChild>
                    <Link href="/auth?action=register&role=teacher">
                      Get Started as Teacher <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="shadow-md hover:shadow-accent/30 transition-shadow duration-300 border-2 border-primary/50 hover:border-primary" asChild>
                    <Link href="/auth?action=register&role=student">
                      Join as Student
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative">
                 {/* TODO: Add Framer Motion to ThreeScenePlaceholder for subtle animation */}
                <ThreeScenePlaceholder />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-secondary/30">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Why Choose ProctorPrep?</h2>
              <p className="mt-6 text-lg text-muted-foreground">
                Empowering education with cutting-edge proctoring technology.
              </p>
            </div>
            <div className="grid gap-8 md:gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                 // TODO: Add Framer Motion to Card for staggered reveal or hover effects
                <Card key={index} className="glass-card p-2 hover:shadow-primary/30 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader className="items-center text-center pt-6 pb-4">
                    {React.cloneElement(feature.icon, { className: "h-12 w-12 text-primary" })}
                    <CardTitle className="mt-5 text-xl font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground text-sm pb-6">
                    <p>{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-background via-muted to-background">
          <div className="container px-4 md:px-6 text-center">
             {/* TODO: Add Framer Motion for reveal */}
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to Elevate Your Online Exams?
            </h2>
            <p className="mt-6 mb-10 text-lg text-muted-foreground max-w-2xl mx-auto">
              Join ProctorPrep today and experience a seamless, secure, and intelligent proctoring solution.
            </p>
            <Button size="lg" className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300 py-3 px-8 text-lg" asChild>
              <Link href="/auth?action=register">
                Sign Up Now <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
