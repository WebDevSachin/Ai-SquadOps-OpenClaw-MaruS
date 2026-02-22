"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Users,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Play,
  Sparkles,
  Cpu,
  Network,
  Layers,
  ChevronRight,
  Star,
  BarChart3,
  Clock,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card } from "@/components/ui";

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isInView]);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, end, duration]);

  return { count, ref };
}

// Stats component
function StatItem({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const { count, ref } = useCounter(value);
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-white mb-2">
        {count}{suffix}
      </div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  );
}

// Navigation
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SquadOps</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Button onClick={() => router.push("/")}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-900 border-b border-gray-800">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block text-gray-400 hover:text-white py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3 border-t border-gray-800 space-y-2">
              <Link href="/auth/login" className="block w-full">
                <Button variant="secondary" fullWidth>Sign in</Button>
              </Link>
              <Link href="/auth/signup" className="block w-full">
                <Button fullWidth>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// Hero Section
function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-gray-950 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">Now with 100-Agent Swarm Technology</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6">
            Deploy{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Agent Swarms
            </span>
            {" "}at Scale
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            The most powerful AI operations platform. Orchestrate 100+ autonomous agents 
            working in harmony to automate complex workflows, research, and operations.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/auth/signup">
              <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                Start Free Trial
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<Play className="w-5 h-5" />}
              onClick={() => router.push("/auth/login")}
            >
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-t border-gray-800/50">
            <StatItem value={100} label="Agents per Swarm" suffix="+" />
            <StatItem value={50} label="K+ Tasks Automated" suffix="" />
            <StatItem value={99} label="% Uptime" suffix=".9" />
            <StatItem value={10} label="x Faster Research" suffix="" />
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-16 relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-2xl" />
          <Card className="relative overflow-hidden border-gray-700/50">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="p-6 md:p-8">
              {/* Mock Dashboard UI */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 text-center text-sm text-gray-500">SquadOps Dashboard</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Agent Swarm Card */}
                <div className="col-span-2 bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Network className="w-5 h-5 text-indigo-400" />
                      <span className="text-white font-medium">Active Swarm</span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Running</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1 mb-4">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-full aspect-square rounded-sm ${
                          i < 78
                            ? "bg-green-500/60"
                            : i < 85
                            ? "bg-yellow-500/60"
                            : "bg-gray-700/50"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>78/100 Active</span>
                    <span>Processing: Research Task #2847</span>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="space-y-4">
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-400 text-sm">Active Agents</span>
                    </div>
                    <div className="text-2xl font-bold text-white">2,847</div>
                    <div className="text-xs text-green-400">+12% from last hour</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-400 text-sm">Tasks Completed</span>
                    </div>
                    <div className="text-2xl font-bold text-white">156.2K</div>
                    <div className="text-xs text-green-400">+8.5% today</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Network,
      title: "100-Agent Swarms",
      description: "Deploy massive swarms of autonomous AI agents that work in parallel to tackle complex research and operational tasks.",
      color: "from-indigo-500 to-purple-600",
    },
    {
      icon: Zap,
      title: "Real-time Orchestration",
      description: "Intelligent task distribution and load balancing ensures optimal performance across your entire agent fleet.",
      color: "from-yellow-500 to-orange-600",
    },
    {
      icon: Globe,
      title: "Multi-Platform Integration",
      description: "Seamlessly connect with Telegram, Discord, Slack, email, and 50+ other platforms out of the box.",
      color: "from-blue-500 to-cyan-600",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption, audit logging, role-based access control, and compliance-ready infrastructure.",
      color: "from-green-500 to-emerald-600",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Deep insights into agent performance, cost tracking, and ROI metrics across all operations.",
      color: "from-pink-500 to-rose-600",
    },
    {
      icon: MessageSquare,
      title: "Human-in-the-Loop",
      description: "Smart approval workflows ensure critical decisions are reviewed by humans when needed.",
      color: "from-violet-500 to-purple-600",
    },
  ];

  return (
    <section id="features" className="py-24 bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything you need to scale AI operations
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            From research swarms to customer support bots, SquadOps provides the infrastructure 
            to deploy and manage AI agents at any scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} hover className="group">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// How it Works Section
function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Connect Your Platforms",
      description: "Link your Telegram, Discord, email, and other channels in minutes with our guided setup.",
      icon: Layers,
    },
    {
      number: "02",
      title: "Configure Your Swarm",
      description: "Define agent roles, specialties, and workflows. Choose from templates or build custom.",
      icon: Cpu,
    },
    {
      number: "03",
      title: "Deploy & Scale",
      description: "Launch your agent swarm and watch it handle tasks autonomously while you focus on strategy.",
      icon: Zap,
    },
  ];

  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Get started in minutes, not months
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Our streamlined onboarding gets your first agent swarm running in under 10 minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="text-6xl font-bold text-gray-800 mb-4">{step.number}</div>
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-4">
                <step.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
              
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                  <ChevronRight className="w-8 h-8 text-gray-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for small teams getting started with AI agents",
      features: [
        "10 Active Agents",
        "1,000 Tasks/month",
        "2 Platform Integrations",
        "Basic Analytics",
        "Email Support",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      description: "For growing teams that need more power and flexibility",
      features: [
        "50 Active Agents",
        "10,000 Tasks/month",
        "10 Platform Integrations",
        "Advanced Analytics",
        "Priority Support",
        "Custom Workflows",
        "API Access",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For organizations requiring maximum scale and security",
      features: [
        "Unlimited Agents",
        "Unlimited Tasks",
        "All Integrations",
        "Custom Analytics",
        "24/7 Dedicated Support",
        "SSO & SAML",
        "On-premise Option",
        "Custom Contracts",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Start free, upgrade when you need. No hidden fees, no surprises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative ${plan.popular ? "border-indigo-500/50" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-indigo-600 text-white text-sm font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-gray-400 text-sm mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/auth/signup">
                <Button
                  variant={plan.popular ? "primary" : "secondary"}
                  fullWidth
                >
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "SquadOps transformed our research process. What used to take our team a week now happens overnight with 100 agents working in parallel.",
      author: "Sarah Chen",
      role: "Head of Research, TechCorp",
      rating: 5,
    },
    {
      quote: "The swarm technology is genuinely impressive. We've automated 80% of our customer support workflows while improving response quality.",
      author: "Marcus Johnson",
      role: "CTO, SupportAI",
      rating: 5,
    },
    {
      quote: "Best-in-class orchestration platform. The human-in-the-loop features give us confidence to automate even critical workflows.",
      author: "Elena Rodriguez",
      role: "VP Operations, FinanceFlow",
      rating: 5,
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Loved by operations teams worldwide
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-gray-900/50">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
              <div>
                <p className="text-white font-medium">{testimonial.author}</p>
                <p className="text-gray-500 text-sm">{testimonial.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Section
function FAQSection() {
  const faqs = [
    {
      question: "What is an AI Agent Swarm?",
      answer: "An AI Agent Swarm is a coordinated group of autonomous AI agents working together on complex tasks. SquadOps enables you to deploy up to 100 agents that work in parallel, significantly accelerating research, analysis, and operational workflows.",
    },
    {
      question: "How does the human-in-the-loop feature work?",
      answer: "You can configure approval workflows for critical decisions. When an agent encounters a task requiring approval, it pauses and notifies designated team members via your preferred channels (email, Slack, Telegram) before proceeding.",
    },
    {
      question: "What platforms can I integrate with?",
      answer: "SquadOps supports 50+ integrations including Telegram, Discord, Slack, Microsoft Teams, Gmail, Outlook, HubSpot, Salesforce, and custom webhooks. New integrations are added regularly.",
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use bank-grade AES-256 encryption, maintain SOC 2 Type II compliance, offer on-premise deployment options for enterprise customers, and never train models on your data.",
    },
    {
      question: "Can I try before I buy?",
      answer: "Yes! We offer a 14-day free trial with full access to all features. No credit card required to start.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-gray-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card key={index} className="bg-gray-900/50">
              <h3 className="text-lg font-medium text-white mb-2">{faq.question}</h3>
              <p className="text-gray-400">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="relative overflow-hidden text-center p-12">
          {/* Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to deploy your first swarm?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Join thousands of teams already using SquadOps to automate their operations. 
              Start your free trial today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                  Get Started Free
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="secondary" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  const footerLinks = {
    Product: ["Features", "Pricing", "Integrations", "Changelog", "Roadmap"],
    Company: ["About", "Blog", "Careers", "Press", "Contact"],
    Resources: ["Documentation", "API Reference", "Guides", "Community", "Support"],
    Legal: ["Privacy", "Terms", "Security", "Cookies"],
  };

  return (
    <footer className="py-16 bg-gray-950 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SquadOps</span>
            </Link>
            <p className="text-gray-400 text-sm mb-4 max-w-xs">
              The most powerful AI operations platform. Deploy agent swarms at scale.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Globe className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <MessageSquare className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-medium mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2025 SquadOps. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-500 text-sm">SOC 2 Type II Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page
export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-gray-800 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
