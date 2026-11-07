/**
 * FAQ dataset for the portfolio's client-side "ask about my portfolio" widget.
 *
 * Every entry here is grounded in the real content files shipped alongside
 * this site (llms.txt and portfolio.md) — nothing invented, no made-up
 * metrics. Keep "question" phrased like something a visitor would actually
 * type, and "answer" short (1-3 sentences) and factual.
 *
 * This is a plain data array on purpose: it is the corpus that both the
 * instant keyword matcher and the (optional, lazily-loaded) embedding
 * matcher in faq.js search over.
 */
export const faqData = [
  {
    question: "What does he do at Amazon?",
    answer:
      "He's a Senior Software Engineer at Amazon, based in Cupertino, California, building and scaling web-based applications with a focus on user experience and system reliability.",
  },
  {
    question: "How many years of experience does he have?",
    answer:
      "He has 10+ years of experience as a full-stack software engineer, building web and mobile applications across roles in the San Francisco Bay Area, San Jose, Boise (Idaho), and Gurgaon (India).",
  },
  {
    question: "Where is he located?",
    answer:
      "He's based in the San Francisco Bay Area, California, USA, and currently works out of Amazon's Cupertino office.",
  },
  {
    question: "What did he study / where did he go to school?",
    answer: "He studied at Kurukshetra University, from 2006 to 2010.",
  },
  {
    question: "What does he focus on technically?",
    answer:
      "His focus areas are AI/ML integration, children's education technology, e-commerce, and business automation, usually built with Next.js, Node.js, and JavaScript/TypeScript.",
  },
  {
    question: "Has he shipped anything to production?",
    answer:
      "Yes — he's built and deployed multiple production applications on Vercel, including KidsVerse/FamilyHearts, Jide, Rhythm & Ocean, ContentAI Pro, STOCK'er, and InsightCanvas, among others.",
  },
  {
    question: "What AI projects has he built?",
    answer:
      "Several, including KidsVerse/FamilyHearts (AI story generation for kids), Jide (an AI lead-gen chatbot for real estate), ContentAI Pro (AI content generation), STOCK'er (AI stock sentiment tracking), and InsightCanvas (Perplexity + Grok-powered research visualizations).",
  },
  {
    question: "What is KidsVerse or FamilyHearts?",
    answer:
      "FamilyHearts (also called KidsVerse) is an AI-powered interactive storytelling platform for children with real-time story generation and personalized child profiles. It's live at familyhearts.fun.",
  },
  {
    question: "What is Jide?",
    answer:
      "Jide is an AI-powered lead-generation and CRM chatbot built for real estate brokers, handling client management and automated lead nurturing. It's live at jide-five.vercel.app.",
  },
  {
    question: "What is Rhythm & Ocean?",
    answer:
      "Rhythm & Ocean is a kids' clothing e-commerce platform he built with an AI-powered virtual try-on feature, live at rhythmocean.vercel.app.",
  },
  {
    question: "What is ContentAI Pro?",
    answer:
      "ContentAI Pro is an AI content generation platform he built for producing SEO-optimized blog posts, social captions, and product descriptions, live at v0-ai-powered-content-generator-rho.vercel.app.",
  },
  {
    question: "What is STOCK'er?",
    answer:
      "STOCK'er is a real-time AI-powered stock market sentiment tracker he built, live at sentiment-app-ten.vercel.app.",
  },
  {
    question: "What is InsightCanvas?",
    answer:
      "InsightCanvas is an AI research platform he built that combines Perplexity search with Grok AI visualizations, live at gen-ui-insights.vercel.app.",
  },
  {
    question: "What AI/ML services or tools does he use?",
    answer:
      "His projects integrate AI/ML services like OpenAI, Perplexity, and Grok, along with Clerk for authentication, and are typically deployed on Vercel and AWS.",
  },
  {
    question: "What technologies or stack does he mainly work with?",
    answer:
      "Primarily JavaScript/TypeScript, React.js and Next.js, and Node.js for full-stack development, with AI/ML integrations, RESTful APIs, and cloud deployment on Vercel and AWS.",
  },
  {
    question: "How can I contact him or see his work?",
    answer:
      "You can reach him at ankursoni948@gmail.com, see his code on GitHub at github.com/soniAnkur, or connect on LinkedIn at linkedin.com/in/ankursoni948. His site is ankursoni.com.",
  },
  {
    question: "Does he have experience with education technology?",
    answer:
      "Yes — children's education technology is one of his focus areas, most visibly through FamilyHearts/KidsVerse, his AI-powered interactive storytelling platform for kids.",
  },
];
