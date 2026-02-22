/**
 * YouTube Researcher Agent - Demo Mode
 * Works without a real API key by returning realistic sample data
 * Falls back to demo mode when OPENROUTER_API_KEY is not configured
 */

import { BaseAgent, AgentTask, AgentResult, AgentConfig } from "../agent-base";

// Types (re-exported for convenience)
export interface YouTubeResearchPayload {
  niche: string;
  maxCreators?: number;
  minSubscribers?: number;
  includeStats?: boolean;
}

export interface YouTubeCreator {
  channelName: string;
  channelUrl: string;
  subscribers: string;
  subscriberCount?: number;
  niche: string;
  videoCount: number;
  avgViews: string;
  avgViewCount?: number;
  recentVideos?: Array<{
    title: string;
    views: string;
    publishedAt: string;
  }>;
  description?: string;
  profileImage?: string;
}

export interface YouTubeResearchResult {
  niche: string;
  creators: YouTubeCreator[];
  totalFound: number;
  searchQuery: string;
  timestamp: string;
}

// Demo data templates for different niches
export interface DemoCreatorTemplate {
  channelName: string;
  channelUrl: string;
  subscribers: string;
  subscriberCount: number;
  videoCount: number;
  avgViews: string;
  avgViewCount: number;
  description: string;
  recentVideos: Array<{
    title: string;
    views: string;
    publishedAt: string;
  }>;
}

// Demo creators data (exported for use by main agent)
export const DEMO_CREATORS: Record<string, DemoCreatorTemplate[]> = {
  programming: [
    {
      channelName: "Tech With Tim",
      channelUrl: "https://www.youtube.com/@TechWithTim",
      subscribers: "1.5M",
      subscriberCount: 1500000,
      videoCount: 850,
      avgViews: "250K",
      avgViewCount: 250000,
      description: "Python tutorials, coding projects, and software engineering career advice for beginners and intermediate developers.",
      recentVideos: [
        { title: "Build a Full-Stack App with Next.js 14", views: "420K views", publishedAt: "3 days ago" },
        { title: "Python vs JavaScript in 2024 - Which Should You Learn?", views: "380K views", publishedAt: "1 week ago" },
        { title: "10 Coding Projects That Will Get You Hired", views: "520K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Programming with Mosh",
      channelUrl: "https://www.youtube.com/@programmingwithmosh",
      subscribers: "3.2M",
      subscriberCount: 3200000,
      videoCount: 180,
      avgViews: "800K",
      avgViewCount: 800000,
      description: "Comprehensive programming tutorials covering Python, JavaScript, React, Node.js and software design patterns.",
      recentVideos: [
        { title: "React 19 Full Course - Build 5 Projects", views: "1.2M views", publishedAt: "5 days ago" },
        { title: "TypeScript Mastery - Complete Guide", views: "890K views", publishedAt: "1 week ago" },
        { title: "System Design Interview Questions", views: "750K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Fireship",
      channelUrl: "https://www.youtube.com/@Fireship",
      subscribers: "2.8M",
      subscriberCount: 2800000,
      videoCount: 620,
      avgViews: "600K",
      avgViewCount: 600000,
      description: "High-intensity code tutorials and tech news in 100 seconds or less. Web development, AI, and DevOps content.",
      recentVideos: [
        { title: "Kubernetes in 100 Seconds", views: "1.5M views", publishedAt: "2 days ago" },
        { title: "Docker Tutorial - Complete Guide 2024", views: "920K views", publishedAt: "1 week ago" },
        { title: "AI Coding Tools Battle - GitHub Copilot vs Cursor", views: "680K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Traversy Media",
      channelUrl: "https://www.youtube.com/@TraversyMedia",
      subscribers: "2.1M",
      subscriberCount: 2100000,
      videoCount: 950,
      avgViews: "350K",
      avgViewCount: 350000,
      description: "Web development tutorials covering HTML, CSS, JavaScript, React, PHP, Python and full-stack development.",
      recentVideos: [
        { title: "Build a SaaS with Next.js and Stripe", views: "480K views", publishedAt: "4 days ago" },
        { title: "CSS Grid vs Flexbox - When to Use Which", views: "320K views", publishedAt: "1 week ago" },
        { title: "My VS Code Setup for Maximum Productivity", views: "290K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "The Coding Train",
      channelUrl: "https://www.youtube.com/@TheCodingTrain",
      subscribers: "1.8M",
      subscriberCount: 1800000,
      videoCount: 1200,
      avgViews: "180K",
      avgViewCount: 180000,
      description: "Creative coding tutorials using p5.js, Processing, and JavaScript. Fun programming challenges and generative art.",
      recentVideos: [
        { title: "Neural Networks from Scratch in JavaScript", views: "240K views", publishedAt: "3 days ago" },
        { title: "Generative Art with Perlin Noise", views: "180K views", publishedAt: "1 week ago" },
        { title: "Building a Physics Engine - Part 1", views: "320K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  fitness: [
    {
      channelName: "Athlean-X",
      channelUrl: "https://www.youtube.com/@athleanx",
      subscribers: "13.5M",
      subscriberCount: 13500000,
      videoCount: 1450,
      avgViews: "1.2M",
      avgViewCount: 1200000,
      description: "Science-based fitness training, injury prevention, and workout advice from physical therapist Jeff Cavaliere.",
      recentVideos: [
        { title: "The Perfect Push-Up Form (FIX YOURS!)", views: "2.1M views", publishedAt: "2 days ago" },
        { title: "6 Pack Abs Workout - No Equipment Needed", views: "1.8M views", publishedAt: "1 week ago" },
        { title: "Common Gym Mistakes That Cause Injury", views: "3.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Chloe Ting",
      channelUrl: "https://www.youtube.com/@ChloeTing",
      subscribers: "24.8M",
      subscriberCount: 24800000,
      videoCount: 420,
      avgViews: "2.5M",
      avgViewCount: 2500000,
      description: "Free workout programs, fitness challenges, and healthy lifestyle content. Known for transformative 2-week shred challenges.",
      recentVideos: [
        { title: "Intense Full Body HIIT - No Equipment", views: "1.9M views", publishedAt: "3 days ago" },
        { title: "15 Min Abs Workout - Flat Stomach Challenge", views: "2.4M views", publishedAt: "1 week ago" },
        { title: "What I Eat in a Day - Healthy Meal Prep", views: "1.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Jeff Nippard",
      channelUrl: "https://www.youtube.com/@JeffNippard",
      subscribers: "6.2M",
      subscriberCount: 6200000,
      videoCount: 580,
      avgViews: "850K",
      avgViewCount: 850000,
      description: "Evidence-based bodybuilding and fitness content backed by scientific research. Training programs and nutrition advice.",
      recentVideos: [
        { title: "The Science of Muscle Growth Explained", views: "1.1M views", publishedAt: "4 days ago" },
        { title: "Full Body Workout for Natural Bodybuilders", views: "920K views", publishedAt: "1 week ago" },
        { title: "Protein Timing - Does It Really Matter?", views: "780K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "THENX",
      channelUrl: "https://www.youtube.com/@OFFICIALTHENX",
      subscribers: "7.5M",
      subscriberCount: 7500000,
      videoCount: 380,
      avgViews: "1.8M",
      avgViewCount: 1800000,
      description: "Calisthenics and bodyweight training workouts. Learn how to build muscle and strength using only your body.",
      recentVideos: [
        { title: "How to Master the Muscle-Up in 30 Days", views: "2.8M views", publishedAt: "5 days ago" },
        { title: "Complete Home Calisthenics Workout", views: "1.5M views", publishedAt: "1 week ago" },
        { title: "6 Pack Abs with Calisthenics Only", views: "1.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Yoga with Adriene",
      channelUrl: "https://www.youtube.com/@yogawithadriene",
      subscribers: "12.2M",
      subscriberCount: 12200000,
      videoCount: 720,
      avgViews: "650K",
      avgViewCount: 650000,
      description: "Free yoga videos for all levels. Find what feels good with yoga practices for mindfulness, flexibility, and strength.",
      recentVideos: [
        { title: "30 Day Yoga Challenge - Day 1", views: "890K views", publishedAt: "1 day ago" },
        { title: "Yoga for Stress Relief - 20 Minutes", views: "720K views", publishedAt: "1 week ago" },
        { title: "Morning Yoga Flow to Wake Up Your Body", views: "580K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  cooking: [
    {
      channelName: "Joshua Weissman",
      channelUrl: "https://www.youtube.com/@JoshuaWeissman",
      subscribers: "9.5M",
      subscriberCount: 9500000,
      videoCount: 520,
      avgViews: "2.8M",
      avgViewCount: 2800000,
      description: "Making better versions of fast food at home, bread baking, and restaurant-quality recipes for the home cook.",
      recentVideos: [
        { title: "Making McDonald's Fries But Better", views: "4.2M views", publishedAt: "2 days ago" },
        { title: "The Perfect Sourdough Bread Guide", views: "3.1M views", publishedAt: "1 week ago" },
        { title: "I Ate At Every 3-Star Michelin Restaurant", views: "2.8M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Babish Culinary Universe",
      channelUrl: "https://www.youtube.com/@babishculinaryuniverse",
      subscribers: "10.2M",
      subscriberCount: 10200000,
      videoCount: 480,
      avgViews: "3.2M",
      avgViewCount: 3200000,
      description: "Recreating iconic foods from movies, TV shows, and video games. Plus Basics with Babish cooking fundamentals.",
      recentVideos: [
        { title: "Recreating The Simpsons' Pink Donut", views: "5.1M views", publishedAt: "3 days ago" },
        { title: "Making the Krabby Patty from SpongeBob", views: "4.8M views", publishedAt: "1 week ago" },
        { title: "Every Way to Cook a Steak (43 Methods)", views: "3.5M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Gordon Ramsay",
      channelUrl: "https://www.youtube.com/@gordonramsay",
      subscribers: "21.5M",
      subscriberCount: 21500000,
      videoCount: 890,
      avgViews: "1.5M",
      avgViewCount: 1500000,
      description: "World-class recipes, cooking tutorials, and behind-the-scenes content from the legendary chef and restaurateur.",
      recentVideos: [
        { title: "Ramsay's Ultimate Sunday Roast", views: "2.8M views", publishedAt: "4 days ago" },
        { title: "Perfect Scrambled Eggs - MasterClass", views: "4.2M views", publishedAt: "1 week ago" },
        { title: "Kitchen Nightmares: The WORST Restaurant", views: "6.5M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Bon Appétit",
      channelUrl: "https://www.youtube.com/@bonappetit",
      subscribers: "6.8M",
      subscriberCount: 6800000,
      videoCount: 1650,
      avgViews: "950K",
      avgViewCount: 950000,
      description: "Test kitchen recipes, cooking techniques, and food culture content from the popular food magazine.",
      recentVideos: [
        { title: "Pro Chefs Make Their Favorite Sandwiches", views: "1.8M views", publishedAt: "5 days ago" },
        { title: "Brad Makes Fermented Hot Sauce", views: "1.2M views", publishedAt: "1 week ago" },
        { title: "Every Way to Cook an Egg (59 Methods)", views: "2.1M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Maangchi",
      channelUrl: "https://www.youtube.com/@Maangchi",
      subscribers: "6.5M",
      subscriberCount: 6500000,
      videoCount: 520,
      avgViews: "520K",
      avgViewCount: 520000,
      description: "Authentic Korean cooking made easy and fun. Traditional recipes and modern Korean fusion dishes.",
      recentVideos: [
        { title: "How to Make Perfect Kimchi", views: "1.2M views", publishedAt: "3 days ago" },
        { title: "Korean Fried Chicken Recipe", views: "890K views", publishedAt: "1 week ago" },
        { title: "My Mother's Bulgogi Recipe", views: "720K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  gaming: [
    {
      channelName: "PewDiePie",
      channelUrl: "https://www.youtube.com/@PewDiePie",
      subscribers: "111M",
      subscriberCount: 111000000,
      videoCount: 4700,
      avgViews: "4.2M",
      avgViewCount: 4200000,
      description: "Gaming commentary, meme reviews, and vlogs from the most subscribed individual creator on YouTube.",
      recentVideos: [
        { title: "Playing Minecraft After 10 Years", views: "8.5M views", publishedAt: "2 days ago" },
        { title: "Reacting to My Old Videos (Cringe Alert)", views: "6.2M views", publishedAt: "1 week ago" },
        { title: "I Bought Every Console Ever Made", views: "5.8M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Markiplier",
      channelUrl: "https://www.youtube.com/@markiplier",
      subscribers: "36.8M",
      subscriberCount: 36800000,
      videoCount: 5600,
      avgViews: "3.8M",
      avgViewCount: 3800000,
      description: "Let's plays of horror games, indie titles, and comedic gaming content with high production value.",
      recentVideos: [
        { title: "Five Nights at Freddy's: Security Breach", views: "5.2M views", publishedAt: "1 day ago" },
        { title: "Try Not To Laugh Challenge #42", views: "4.1M views", publishedAt: "1 week ago" },
        { title: "I Played the Worst Rated Game on Steam", views: "3.8M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Ninja",
      channelUrl: "https://www.youtube.com/@Ninja",
      subscribers: "23.5M",
      subscriberCount: 23500000,
      videoCount: 1650,
      avgViews: "1.2M",
      avgViewCount: 1200000,
      description: "Fortnite gameplay, pro gaming tips, and highlights from one of the world's most popular streamers.",
      recentVideos: [
        { title: "My First Victory Royale in Chapter 5", views: "2.8M views", publishedAt: "3 days ago" },
        { title: "Fortnite Arena - Road to Champion League", views: "1.5M views", publishedAt: "1 week ago" },
        { title: "Teaching My Wife to Play Fortnite", views: "2.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Game Theory",
      channelUrl: "https://www.youtube.com/@GameTheory",
      subscribers: "19.2M",
      subscriberCount: 19200000,
      videoCount: 680,
      avgViews: "3.5M",
      avgViewCount: 3500000,
      description: "Deep dives into video game lore, science, and theories. Connecting fictional worlds to real-world concepts.",
      recentVideos: [
        { title: "The SECRET Identity of the Minecraft Enderman", views: "5.8M views", publishedAt: "4 days ago" },
        { title: "FNAF: The Final Timeline Revealed", views: "6.2M views", publishedAt: "1 week ago" },
        { title: "Can You Survive the Zelda Water Temple?", views: "4.1M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Dream",
      channelUrl: "https://www.youtube.com/@Dream",
      subscribers: "31.8M",
      subscriberCount: 31800000,
      videoCount: 120,
      avgViews: "25M",
      avgViewCount: 25000000,
      description: "Minecraft speedruns, challenges, and the legendary Manhunt series. High-stakes gaming content.",
      recentVideos: [
        { title: "Minecraft Speedrunner VS 5 Hunters", views: "48M views", publishedAt: "1 month ago" },
        { title: "Unsolved Mystery of the Minecraft Discs", views: "22M views", publishedAt: "2 months ago" },
        { title: "Minecraft, But Crafting Is OP", views: "18M views", publishedAt: "3 months ago" },
      ],
    },
  ],
  finance: [
    {
      channelName: "Graham Stephan",
      channelUrl: "https://www.youtube.com/@GrahamStephan",
      subscribers: "4.5M",
      subscriberCount: 4500000,
      videoCount: 1200,
      avgViews: "850K",
      avgViewCount: 850000,
      description: "Real estate investing, personal finance, stock market strategies, and reacting to how others spend money.",
      recentVideos: [
        { title: "How I Bought 10 Houses Before Age 30", views: "1.8M views", publishedAt: "2 days ago" },
        { title: "Millionaire Reacts to $500,000 Salary Budget", views: "1.2M views", publishedAt: "1 week ago" },
        { title: "Why You Should NOT Buy a House in 2024", views: "2.1M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Andrei Jikh",
      channelUrl: "https://www.youtube.com/@AndreiJikh",
      subscribers: "2.8M",
      subscriberCount: 2800000,
      videoCount: 380,
      avgViews: "720K",
      avgViewCount: 720000,
      description: "Personal finance, investing in index funds, dividend stocks, and building wealth through compound interest.",
      recentVideos: [
        { title: "I Invested $100k in Dividend Stocks - Results", views: "1.5M views", publishedAt: "3 days ago" },
        { title: "How to Retire Early with $2 Million", views: "980K views", publishedAt: "1 week ago" },
        { title: "The 50/30/20 Budget Rule Explained", views: "820K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "The Plain Bagel",
      channelUrl: "https://www.youtube.com/@ThePlainBagel",
      subscribers: "1.8M",
      subscriberCount: 1800000,
      videoCount: 280,
      avgViews: "580K",
      avgViewCount: 580000,
      description: "Simplified investing and financial education. Understanding the stock market, ETFs, and portfolio building.",
      recentVideos: [
        { title: "Index Funds vs ETFs - Which is Better?", views: "920K views", publishedAt: "4 days ago" },
        { title: "How to Analyze a Stock in 10 Minutes", views: "750K views", publishedAt: "1 week ago" },
        { title: "The Truth About Day Trading", views: "680K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Meet Kevin",
      channelUrl: "https://www.youtube.com/@MeetKevin",
      subscribers: "2.1M",
      subscriberCount: 2100000,
      videoCount: 2800,
      avgViews: "380K",
      avgViewCount: 380000,
      description: "Real estate investing strategies, market analysis, and economic news. Building passive income through property.",
      recentVideos: [
        { title: "Housing Market Crash 2024 - What You Need to Know", views: "1.2M views", publishedAt: "5 days ago" },
        { title: "I Lost $500k on Real Estate - Here's Why", views: "890K views", publishedAt: "1 week ago" },
        { title: "How to Buy Your First Rental Property", views: "650K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Two Cents",
      channelUrl: "https://www.youtube.com/@TwoCentsPB",
      subscribers: "1.2M",
      subscriberCount: 1200000,
      videoCount: 320,
      avgViews: "420K",
      avgViewCount: 420000,
      description: "Personal finance basics made simple. Budgeting, saving, credit cards, and making smart money decisions.",
      recentVideos: [
        { title: "Credit Score Myths Debunked", views: "680K views", publishedAt: "3 days ago" },
        { title: "Emergency Fund - How Much Do You Need?", views: "520K views", publishedAt: "1 week ago" },
        { title: "Should You Pay Off Debt or Invest?", views: "480K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  technology: [
    {
      channelName: "Marques Brownlee",
      channelUrl: "https://www.youtube.com/@mkbhd",
      subscribers: "18.5M",
      subscriberCount: 18500000,
      videoCount: 1650,
      avgViews: "4.2M",
      avgViewCount: 4200000,
      description: "In-depth technology reviews of smartphones, laptops, cameras, and electric vehicles. High production quality.",
      recentVideos: [
        { title: "iPhone 16 Pro Max - The Complete Review", views: "8.2M views", publishedAt: "1 day ago" },
        { title: "Tesla Cybertruck: 6 Months Later", views: "6.8M views", publishedAt: "1 week ago" },
        { title: "The Best Smartphone of 2024", views: "5.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Linus Tech Tips",
      channelUrl: "https://www.youtube.com/@LinusTechTips",
      subscribers: "15.8M",
      subscriberCount: 15800000,
      videoCount: 7200,
      avgViews: "1.8M",
      avgViewCount: 1800000,
      description: "PC building guides, tech reviews, and exploring cutting-edge technology. Building the ultimate gaming setups.",
      recentVideos: [
        { title: "I Built a $50,000 Gaming PC", views: "4.2M views", publishedAt: "2 days ago" },
        { title: "RTX 5090 Early Benchmarks Leaked!", views: "3.8M views", publishedAt: "1 week ago" },
        { title: "Why I Switched to Linux for Gaming", views: "2.9M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Unbox Therapy",
      channelUrl: "https://www.youtube.com/@UnboxTherapy",
      subscribers: "24.2M",
      subscriberCount: 24200000,
      videoCount: 2150,
      avgViews: "2.2M",
      avgViewCount: 2200000,
      description: "Unboxing the latest gadgets and technology. First impressions of smartphones, weird tech, and accessories.",
      recentVideos: [
        { title: "The $10,000 Smartphone From Dubai", views: "5.8M views", publishedAt: "3 days ago" },
        { title: "This Keyboard is Also a Computer", views: "3.2M views", publishedAt: "1 week ago" },
        { title: "World's Most Expensive Headphones", views: "4.1M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Mrwhosetheboss",
      channelUrl: "https://www.youtube.com/@Mrwhosetheboss",
      subscribers: "19.8M",
      subscriberCount: 19800000,
      videoCount: 580,
      avgViews: "5.5M",
      avgViewCount: 5500000,
      description: "Smartphone comparisons, tech analysis, and creative tech content with stunning visuals and in-depth research.",
      recentVideos: [
        { title: "I've Used Every Samsung Galaxy S Phone", views: "12M views", publishedAt: "4 days ago" },
        { title: "The Truth About Foldable Phones in 2024", views: "8.5M views", publishedAt: "1 week ago" },
        { title: "Why iPhones Don't Have This Feature", views: "6.2M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Dave2D",
      channelUrl: "https://www.youtube.com/@Dave2D",
      subscribers: "3.8M",
      subscriberCount: 3800000,
      videoCount: 850,
      avgViews: "1.5M",
      avgViewCount: 1500000,
      description: "Laptop reviews, tech recommendations, and honest buying advice. Clean, concise tech content.",
      recentVideos: [
        { title: "Best Laptops for Students 2024", views: "2.2M views", publishedAt: "5 days ago" },
        { title: "MacBook Air M3 - Worth the Upgrade?", views: "1.8M views", publishedAt: "1 week ago" },
        { title: "Gaming Laptop Tier List", views: "1.5M views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  beauty: [
    {
      channelName: "James Charles",
      channelUrl: "https://www.youtube.com/@JamesCharles",
      subscribers: "24M",
      subscriberCount: 24000000,
      videoCount: 480,
      avgViews: "3.2M",
      avgViewCount: 3200000,
      description: "Makeup tutorials, beauty transformations, and creative looks. One of the biggest beauty influencers on YouTube.",
      recentVideos: [
        { title: "Full Glam Transformation Tutorial", views: "4.8M views", publishedAt: "2 days ago" },
        { title: "Reacting to My Followers' Makeup", views: "3.5M views", publishedAt: "1 week ago" },
        { title: "I Tried Following a Patrick Ta Tutorial", views: "2.9M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "NikkieTutorials",
      channelUrl: "https://www.youtube.com/@NikkieTutorials",
      subscribers: "14.2M",
      subscriberCount: 14200000,
      videoCount: 850,
      avgViews: "2.8M",
      avgViewCount: 2800000,
      description: "Bold makeup looks, product reviews, and the iconic 'The Power of Makeup' series. High-fashion beauty content.",
      recentVideos: [
        { title: "Full Face Using Only Drugstore Makeup", views: "4.2M views", publishedAt: "3 days ago" },
        { title: "Testing Viral TikTok Beauty Hacks", views: "3.1M views", publishedAt: "1 week ago" },
        { title: "Get Ready With Me - Met Gala Edition", views: "2.5M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Huda Beauty",
      channelUrl: "https://www.youtube.com/@HudaBeauty",
      subscribers: "4.2M",
      subscriberCount: 4200000,
      videoCount: 380,
      avgViews: "380K",
      avgViewCount: 380000,
      description: "Beauty tips, product launches, and skincare routines from Huda Kattan, founder of Huda Beauty cosmetics.",
      recentVideos: [
        { title: "My Complete Skincare Routine", views: "520K views", publishedAt: "4 days ago" },
        { title: "New Huda Beauty Foundation Review", views: "480K views", publishedAt: "1 week ago" },
        { title: "DIY Beauty Treatments at Home", views: "420K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Zoella",
      channelUrl: "https://www.youtube.com/@zoella",
      subscribers: "10.8M",
      subscriberCount: 10800000,
      videoCount: 420,
      avgViews: "520K",
      avgViewCount: 520000,
      description: "Lifestyle, beauty hauls, and vlogs. One of the original UK beauty YouTubers with a focus on affordable products.",
      recentVideos: [
        { title: "Huge Boots Beauty Haul 2024", views: "680K views", publishedAt: "5 days ago" },
        { title: "My Everyday Makeup Routine", views: "580K views", publishedAt: "1 week ago" },
        { title: "Testing New High Street Beauty Products", views: "490K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Wayne Goss",
      channelUrl: "https://www.youtube.com/@gossmakeupartist",
      subscribers: "3.9M",
      subscriberCount: 3900000,
      videoCount: 1650,
      avgViews: "320K",
      avgViewCount: 320000,
      description: "Professional makeup artist tips and techniques. Honest product reviews and beauty industry insights.",
      recentVideos: [
        { title: "Makeup Mistakes That Age Your Face", views: "850K views", publishedAt: "3 days ago" },
        { title: "Best Foundations for Mature Skin", views: "520K views", publishedAt: "1 week ago" },
        { title: "Contouring for Beginners - Step by Step", views: "480K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  travel: [
    {
      channelName: "Kara and Nate",
      channelUrl: "https://www.youtube.com/@karaandnate",
      subscribers: "3.8M",
      subscriberCount: 3800000,
      videoCount: 650,
      avgViews: "850K",
      avgViewCount: 850000,
      description: "Couple traveling to 100 countries, van life adventures, and luxury travel on a budget. Inspiring travel content.",
      recentVideos: [
        { title: "We Bought a House in Portugal!", views: "1.8M views", publishedAt: "2 days ago" },
        { title: "24 Hours in the World's Most Expensive Hotel", views: "2.2M views", publishedAt: "1 week ago" },
        { title: "Living on a Houseboat in Amsterdam", views: "980K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Drew Binsky",
      channelUrl: "https://www.youtube.com/@DrewBinsky",
      subscribers: "5.2M",
      subscriberCount: 5200000,
      videoCount: 1200,
      avgViews: "1.2M",
      avgViewCount: 1200000,
      description: "Traveling to every country in the world. Budget travel tips, cultural experiences, and unique destinations.",
      recentVideos: [
        { title: "I Visited the World's Most Dangerous Country", views: "3.5M views", publishedAt: "3 days ago" },
        { title: "Living with a Tribe in Papua New Guinea", views: "2.8M views", publishedAt: "1 week ago" },
        { title: "$10 vs $1000 Hotel in Tokyo", views: "2.1M views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Lost LeBlanc",
      channelUrl: "https://www.youtube.com/@LostLeBlanc",
      subscribers: "2.5M",
      subscriberCount: 2500000,
      videoCount: 420,
      avgViews: "680K",
      avgViewCount: 680000,
      description: "Cinematic travel films, photography tips, and guides to the world's most beautiful destinations.",
      recentVideos: [
        { title: "Iceland's Hidden Waterfalls - 4K Cinematic", views: "1.2M views", publishedAt: "4 days ago" },
        { title: "How I Film My Travel Videos", views: "890K views", publishedAt: "1 week ago" },
        { title: "Solo Traveling Through Patagonia", views: "750K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Eva zu Beck",
      channelUrl: "https://www.youtube.com/@EvaZuBeck",
      subscribers: "1.8M",
      subscriberCount: 1800000,
      videoCount: 380,
      avgViews: "520K",
      avgViewCount: 520000,
      description: "Off-the-beaten-path travel to unusual destinations. Pakistan, Iraq, and other underexplored countries.",
      recentVideos: [
        { title: "I Moved to a Remote Village in Pakistan", views: "980K views", publishedAt: "5 days ago" },
        { title: "Traveling Alone as a Woman in the Middle East", views: "820K views", publishedAt: "1 week ago" },
        { title: "Life Without Internet for 30 Days", views: "650K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Yes Theory",
      channelUrl: "https://www.youtube.com/@YesTheory",
      subscribers: "8.5M",
      subscriberCount: 8500000,
      videoCount: 320,
      avgViews: "2.8M",
      avgViewCount: 2800000,
      description: "Seeking discomfort through travel challenges, spontaneous adventures, and connecting with strangers worldwide.",
      recentVideos: [
        { title: "Surviving 24 Hours in the Sahara Desert", views: "4.2M views", publishedAt: "3 days ago" },
        { title: "Asking Strangers to Join Our Road Trip", views: "3.8M views", publishedAt: "1 week ago" },
        { title: "We Bought One-Way Tickets to a Random Country", views: "3.2M views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
  // Default fallback creators for unknown niches
  default: [
    {
      channelName: "Creator Central",
      channelUrl: "https://www.youtube.com/@CreatorCentral",
      subscribers: "850K",
      subscriberCount: 850000,
      videoCount: 320,
      avgViews: "125K",
      avgViewCount: 125000,
      description: "Comprehensive content covering tutorials, tips, and strategies for enthusiasts and professionals alike.",
      recentVideos: [
        { title: "The Ultimate Beginner's Guide 2024", views: "280K views", publishedAt: "3 days ago" },
        { title: "10 Tips from Industry Experts", views: "195K views", publishedAt: "1 week ago" },
        { title: "Common Mistakes Beginners Make", views: "165K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "The Niche Pro",
      channelUrl: "https://www.youtube.com/@TheNichePro",
      subscribers: "1.2M",
      subscriberCount: 1200000,
      videoCount: 480,
      avgViews: "280K",
      avgViewCount: 280000,
      description: "In-depth analysis, reviews, and expert insights from years of industry experience and research.",
      recentVideos: [
        { title: "Complete Review - Everything You Need to Know", views: "420K views", publishedAt: "4 days ago" },
        { title: "Industry Trends for 2024", views: "350K views", publishedAt: "1 week ago" },
        { title: "Expert Interview - Behind the Scenes", views: "280K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Daily Dose",
      channelUrl: "https://www.youtube.com/@DailyDose",
      subscribers: "650K",
      subscriberCount: 650000,
      videoCount: 850,
      avgViews: "95K",
      avgViewCount: 95000,
      description: "Daily inspiration, motivation, and practical advice to help you improve and reach your goals faster.",
      recentVideos: [
        { title: "The Morning Routine That Changed My Life", views: "180K views", publishedAt: "5 days ago" },
        { title: "How to Stay Consistent with Your Practice", views: "145K views", publishedAt: "1 week ago" },
        { title: "Myths You Should Stop Believing", views: "120K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Masterclass Hub",
      channelUrl: "https://www.youtube.com/@MasterclassHub",
      subscribers: "2.1M",
      subscriberCount: 2100000,
      videoCount: 280,
      avgViews: "450K",
      avgViewCount: 450000,
      description: "Professional-level tutorials and courses taught by industry veterans with decades of experience.",
      recentVideos: [
        { title: "Advanced Techniques Masterclass", views: "680K views", publishedAt: "2 days ago" },
        { title: "From Beginner to Pro in 30 Days", views: "520K views", publishedAt: "1 week ago" },
        { title: "Secrets the Pros Don't Tell You", views: "480K views", publishedAt: "2 weeks ago" },
      ],
    },
    {
      channelName: "Trend Insights",
      channelUrl: "https://www.youtube.com/@TrendInsights",
      subscribers: "980K",
      subscriberCount: 980000,
      videoCount: 620,
      avgViews: "185K",
      avgViewCount: 185000,
      description: "Latest trends, news, and analysis to keep you informed and ahead of the curve in this fast-moving space.",
      recentVideos: [
        { title: "What's Hot This Month - Trend Report", views: "320K views", publishedAt: "3 days ago" },
        { title: "Future Predictions for 2025", views: "290K views", publishedAt: "1 week ago" },
        { title: "Reacting to the Biggest News This Week", views: "240K views", publishedAt: "2 weeks ago" },
      ],
    },
  ],
};

// Niche keywords mapping for fuzzy mapping (exported for use by main agent)
export const NICHE_MAPPINGS: Record<string, string[]> = {
  programming: ["programming", "coding", "developer", "software", "web development", "app development", "python", "javascript", "react", "full-stack", "frontend", "backend"],
  fitness: ["fitness", "workout", "gym", "exercise", "bodybuilding", "weight loss", "training", "health", "yoga", "crossfit"],
  cooking: ["cooking", "food", "recipe", "chef", "baking", "culinary", "kitchen", "meals", "restaurant", "gourmet"],
  gaming: ["gaming", "games", "gamer", "gameplay", "esports", "minecraft", "fortnite", "call of duty", "streaming", "lets play"],
  finance: ["finance", "investing", "money", "stock market", "crypto", "bitcoin", "personal finance", "wealth", "trading", "real estate"],
  technology: ["technology", "tech", "gadgets", "smartphones", "laptops", "reviews", "unboxing", "ai", "computers", "electronics"],
  beauty: ["beauty", "makeup", "skincare", "cosmetics", "fashion", "hair", "nails", "glam", "tutorial", "product review"],
  travel: ["travel", "traveling", "adventure", "backpacking", "destinations", "tourism", "vacation", "digital nomad", "van life"],
};

/**
 * Helper function to match niche to demo data
 */
function matchNiche(inputNiche: string): string {
  const normalizedNiche = inputNiche.toLowerCase().trim();
  
  // Direct match
  for (const [key, keywords] of Object.entries(NICHE_MAPPINGS)) {
    if (keywords.some(kw => normalizedNiche.includes(kw))) {
      return key;
    }
  }
  
  // Default fallback
  return "default";
}

/**
 * Helper function to simulate API delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * YouTube Researcher Agent - Demo Mode
 * Returns realistic sample data without requiring an API key
 */
export class YouTubeResearcherAgentDemo extends BaseAgent {
  private apiKey?: string;
  private isDemoMode: boolean = true;

  constructor(task: AgentTask, config: AgentConfig & { apiKey?: string } = {}) {
    super(task, config);
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
    
    // Check if we should run in demo mode
    if (!this.apiKey || this.apiKey.length < 10 || this.apiKey === "sk-demo" || this.apiKey.startsWith("demo")) {
      this.isDemoMode = true;
      this.log("info", "Running in DEMO MODE - No valid OPENROUTER_API_KEY detected");
    } else {
      this.isDemoMode = false;
    }
  }

  /**
   * Initialize the agent
   */
  protected async init(): Promise<void> {
    await super.init();
    
    // Validate payload
    const payload = this.task.payload as YouTubeResearchPayload;
    if (!payload.niche || typeof payload.niche !== "string") {
      throw new Error("Invalid payload: 'niche' is required and must be a string");
    }
  }

  /**
   * Main execution logic
   */
  protected async executeTask(): Promise<YouTubeResearchResult> {
    const payload = this.task.payload as YouTubeResearchPayload;
    const niche = payload.niche;
    const maxCreators = Math.min(payload.maxCreators || 3, 5);

    this.updateProgress(10, `Starting research for niche: ${niche}`);
    
    // Log demo mode status
    if (this.isDemoMode) {
      this.log("info", `DEMO MODE: Generating sample data for niche "${niche}"`);
    }

    // Simulate API delay (2-3 seconds)
    this.updateProgress(30, "Connecting to data source...");
    await sleep(800 + Math.random() * 700);

    // Step 1: Identify creators
    this.updateProgress(50, "Identifying top creators...");
    await sleep(600 + Math.random() * 500);
    const matchedNiche = matchNiche(niche);
    const demoCreators = DEMO_CREATORS[matchedNiche] || DEMO_CREATORS.default;
    
    // Step 2: Select creators based on maxCreators
    this.updateProgress(70, "Processing creator data...");
    await sleep(500 + Math.random() * 400);
    const selectedCreators = demoCreators.slice(0, maxCreators);

    // Step 3: Finalize data
    this.updateProgress(90, "Finalizing results...");
    await sleep(400 + Math.random() * 300);
    
    const finalCreators: YouTubeCreator[] = selectedCreators.map((creator, index) => ({
      ...creator,
      channelUrl: creator.channelUrl,
      niche: niche,
      // Add some randomization to make each request slightly different
      videoCount: creator.videoCount + Math.floor(Math.random() * 10),
    }));

    // Build result
    this.updateProgress(100, "Complete!");
    
    const result: YouTubeResearchResult = {
      niche,
      creators: finalCreators,
      totalFound: finalCreators.length,
      searchQuery: this.buildSearchQuery(niche),
      timestamp: new Date().toISOString(),
    };

    // Add demo mode indicator in log
    if (this.isDemoMode) {
      this.log("info", `DEMO MODE: Successfully generated ${finalCreators.length} sample creators for "${niche}"`);
    }

    return result;
  }

  /**
   * Build search query for the niche
   */
  private buildSearchQuery(niche: string): string {
    return `top ${niche} youtubers best creators`;
  }

  /**
   * Check if running in demo mode
   */
  public isRunningInDemoMode(): boolean {
    return this.isDemoMode;
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    await super.cleanup();
  }
}

/**
 * Factory function for creating YouTube researcher demo agents
 */
export function createYouTubeResearcherAgentDemo(task: AgentTask, config: AgentConfig = {}): YouTubeResearcherAgentDemo {
  return new YouTubeResearcherAgentDemo(task, config);
}

/**
 * Template registration helper
 */
export const youtubeResearcherDemoTemplate = {
  id: "youtube-researcher-demo",
  name: "YouTube Researcher (Demo Mode)",
  description: "Demo version that returns realistic sample data without requiring an API key",
  factory: createYouTubeResearcherAgentDemo,
};

export default YouTubeResearcherAgentDemo;
