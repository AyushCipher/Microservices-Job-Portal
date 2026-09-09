"use client";
import React, { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import {
  Clock,
  Headset,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


const contactInfo = [
  {
    icon: Mail,
    title: "Email Us",
    lines: ["support@hireheaven.com", "partnerships@hireheaven.com"],
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: Phone,
    title: "Call Us",
    lines: ["+91 98765 43210", "Mon – Fri, 9am – 6pm IST"],
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: MapPin,
    title: "Visit Us",
    lines: ["4th Floor, Prestige Tech Park", "Bengaluru, Karnataka, India"],
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
  {
    icon: Clock,
    title: "Support Hours",
    lines: ["Monday – Friday: 9am – 6pm", "Saturday: 10am – 2pm"],
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },
];

const faqs = [
  {
    q: "How quickly will I get a response?",
    a: "Our support team typically replies within one business day. Urgent account or payment issues are prioritized and usually resolved within a few hours.",
  },
  {
    q: "I'm a recruiter — how do I get my company verified?",
    a: "Register as a recruiter, add your company profile with a valid work email and website, and our team will verify it within 24-48 hours before your listings go live.",
  },
  {
    q: "Can I request a feature or report a bug?",
    a: "Absolutely — use the form on this page and select the relevant topic. Product feedback goes straight to our engineering team.",
  },
  {
    q: "Do you offer support for job seekers with disabilities?",
    a: "Yes. Reach out via email and our support team will help you navigate the platform or connect with employers offering accessible workplaces.",
  },
];

const ContactPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    // Simulates network latency until a dedicated contact endpoint exists.
    await new Promise((resolve) => setTimeout(resolve, 900));

    toast.success("Message sent. Our team will get back to you soon");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary">
        <div className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-red-500 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 py-14 md:py-20 relative text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-background/60 backdrop-blur-sm mb-5">
            <MessageCircle size={16} className="text-blue-600" />
            <span className="text-sm font-medium">We&apos;d love to hear from you</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Get in Touch with <span className="text-red-500">HireHeaven</span>
          </h1>
          <p className="text-lg leading-relaxed opacity-80 max-w-2xl mx-auto">
            Questions about applying, hiring, billing or partnerships?
            Our team is here to help — reach out and we&apos;ll respond fast.
          </p>
        </div>
      </section>

      {/* Contact info cards */}
      <section className="container mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {contactInfo.map((c) => (
            <Card
              key={c.title}
              className="p-6 border-2 hover:border-blue-500 hover:shadow-lg transition-all"
            >
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${c.bg}`}
              >
                <c.icon size={22} className={c.color} />
              </div>
              <h3 className="font-semibold mb-2">{c.title}</h3>
              {c.lines.map((line) => (
                <p key={line} className="text-sm opacity-70 leading-relaxed">
                  {line}
                </p>
              ))}
            </Card>
          ))}
        </div>
      </section>

      {/* Form + side info */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="grid lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
          {/* Form */}
          <Card className="lg:col-span-3 p-6 md:p-8 border-2 shadow-lg">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Send size={20} className="text-blue-600" />
                Send us a message
              </h2>
              <p className="text-sm opacity-70">
                Fill out the form and our team will get back to you within
                one business day.
              </p>
            </div>

            <form onSubmit={submitHandler} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="How can we help?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Tell us a bit about what you need..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-32 resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Send Message
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Side info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-2 bg-linear-to-br from-blue-600 to-blue-800 text-white overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <Headset size={26} className="mb-4 opacity-90 relative" />
              <h3 className="text-lg font-semibold mb-2 relative">
                Need urgent help?
              </h3>
              <p className="text-sm opacity-90 leading-relaxed relative">
                For account, payment or urgent hiring issues, email us
                directly and mark your subject line as{" "}
                <span className="font-semibold">&ldquo;Urgent&rdquo;</span> —
                our team prioritizes these within business hours.
              </p>
            </Card>

            <Card className="overflow-hidden border-2">
              <div className="aspect-video w-full bg-secondary flex flex-col items-center justify-center gap-2 text-center px-4">
                <MapPin size={28} className="text-blue-600" />
                <p className="text-sm font-medium">
                  4th Floor, Prestige Tech Park
                </p>
                <p className="text-xs opacity-60">
                  Bengaluru, Karnataka, India
                </p>
              </div>
            </Card>

            <Card className="p-6 border-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-blue-600" />
                <h3 className="font-semibold">Quick facts</h3>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li className="flex justify-between">
                  <span className="opacity-70">Avg. response time</span>
                  <span className="font-medium">Under 24 hours</span>
                </li>
                <li className="flex justify-between">
                  <span className="opacity-70">Support languages</span>
                  <span className="font-medium">English, Hindi</span>
                </li>
                <li className="flex justify-between">
                  <span className="opacity-70">Recruiter verification</span>
                  <span className="font-medium">24 – 48 hours</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-secondary/40 border-t py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg opacity-70">
              Can&apos;t find what you&apos;re looking for? Send us a message
              above and we&apos;ll help you out.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem value={`item-${i}`} key={f.q}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm opacity-70 leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
