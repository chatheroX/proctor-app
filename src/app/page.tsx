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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-secondary/30 to-background">
      <AppHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="space-y-6">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                  The Future of <span className="text-primary">Secure</span> Online Proctoring
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  ProctorPrep offers a robust, modern platform for conducting secure online exams, trusted by educators and students alike.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/auth?action=register&role=teacher">
                      Get Started as Teacher <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/auth?action=register&role=student">
                      Join as Student
                    </Link>
                  </Button>
                </div>
              </div>
              <div>
                <ThreeScenePlaceholder />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-muted/40">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why Choose ProctorPrep?</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Empowering education with cutting-edge proctoring technology.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <CardHeader className="items-center text-center">
                    {feature.icon}
                    <CardTitle className="mt-4 text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground">
                    <p>{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Elevate Your Online Exams?
            </h2>
            <p className="mt-4 mb-8 text-lg text-muted-foreground max-w-2xl mx-auto">
              Join ProctorPrep today and experience a seamless, secure, and intelligent proctoring solution.
            </p>
            <Button size="lg" asChild>
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
