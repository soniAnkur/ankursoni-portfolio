// Real resume/portfolio content shown by the in-scene kiosk cards. Plain
// exported data (not fetched at runtime) so it's easy to review/edit later.
// Verbatim per the site owner — do not alter facts here without an explicit
// content change request.

export const STAGES = {
  about: {
    id: "about",
    title: "About",
    body:
      "Senior Software Engineer at Amazon, Cupertino, California. 10+ years full-stack development across the Bay Area, San Jose, Boise (Idaho), and Gurgaon (India). Kurukshetra University (2006–2010). Focus: AI/ML integration, children's education technology, e-commerce, business automation.",
    color: 0x00d9ff,
  },
  skills: {
    id: "skills",
    title: "Skills",
    body:
      "Full-stack: JavaScript, TypeScript, React, Next.js, Node.js. AI: OpenAI, Perplexity, Grok AI, MCP Tools. Cloud/DevOps: Vercel, AWS. Domain expertise: e-commerce and education.",
    color: 0xa855f7,
  },
  projects: {
    id: "projects",
    title: "Projects",
    color: 0xff3d8f,
  },
  contact: {
    id: "contact",
    title: "Contact",
    body: "",
    color: 0x00ff88,
    links: [
      { text: "ankursoni948@gmail.com", href: "mailto:ankursoni948@gmail.com" },
      { text: "linkedin.com/in/ankursoni948", href: "https://linkedin.com/in/ankursoni948" },
      { text: "github.com/soniAnkur", href: "https://github.com/soniAnkur" },
    ],
  },
};

export const PROJECTS = [
  {
    title: "KidsVerse / FamilyHearts",
    body:
      "AI-powered interactive storytelling platform creating personalized storybooks where children become the main characters. Features real-time story generation and adaptive learning.",
    stack: ["Next.js", "AI/ML", "Node.js"],
    url: "https://www.familyhearts.fun",
  },
  {
    title: "Jide - AI Lead Generation",
    body:
      "Professional lead generation system for real estate brokers with AI-powered chatbot. Achieves 50% conversion rate and saves 12-20 hours/week for users.",
    stack: ["Next.js", "AI Chatbot", "CRM"],
    url: "https://jide-five.vercel.app",
  },
  {
    title: "Rhythm & Ocean",
    body:
      "Kids clothing e-commerce platform with innovative AI-powered virtual try-on feature. Complete shopping experience with age-based filtering and newsletter integration.",
    stack: ["Next.js", "E-commerce", "AI Try-On"],
    url: "https://rhythmocean.vercel.app",
  },
  {
    title: "ContentAI Pro",
    body:
      "AI-powered content generation platform for businesses. Creates SEO-optimized blog posts, social media captions, and product descriptions with industry-tailored AI.",
    stack: ["Next.js", "OpenAI", "SEO"],
    url: "https://v0-ai-powered-content-generator-rho.vercel.app",
  },
  {
    title: "STOCK'er - Sentiment Analysis",
    body:
      "Real-time stock market sentiment tracker powered by AI. Provides insights into market perception and emotional tone with interactive dashboard.",
    stack: ["Next.js", "AI/ML", "Real-time"],
    url: "https://sentiment-app-ten.vercel.app",
  },
  {
    title: "InsightCanvas",
    body:
      "AI-powered research platform combining Perplexity search with Grok AI visualizations. Comprehensive research capabilities with interactive components.",
    stack: ["Next.js", "Perplexity", "Grok AI"],
    url: "https://gen-ui-insights.vercel.app",
  },
];

/**
 * Resolve the overlay card content for a kiosk descriptor as produced by
 * track.js ({ stageId, subIndex }). Pure/stateless — safe to call every
 * frame.
 */
export function getKioskContent(kiosk) {
  if (kiosk.stageId === "projects") {
    const project = PROJECTS[kiosk.subIndex] || PROJECTS[0];
    return {
      eyebrow: `PROJECT ${kiosk.subIndex + 1}/${PROJECTS.length}`,
      title: project.title,
      body: project.body,
      stack: project.stack,
      url: project.url,
    };
  }
  const stage = STAGES[kiosk.stageId] || STAGES.about;
  return {
    eyebrow: "CHECKPOINT",
    title: stage.title,
    body: stage.body,
    links: stage.links,
  };
}
