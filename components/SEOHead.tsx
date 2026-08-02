import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteSEO {
  title: string;
  description: string;
}

const ROUTE_SEO: Record<string, RouteSEO> = {
  '/': {
    title: 'Learn English through Kannada | AI English Tutor & Spoken English Course | SIMPLISH Talks',
    description: 'Learn English through Kannada with SIMPLISH Talks. Practice English speaking with your AI tutor, master English grammar in Kannada, build daily vocabulary, and prepare for HR job interviews in Karnataka.',
  },
  '/packages': {
    title: 'Spoken English Course Plans & Pricing | Learn English in Karnataka | SIMPLISH Talks',
    description: 'Explore affordable spoken English course packages for Karnataka students & job seekers. Practice English speaking daily with personal AI English tutor Snehi.',
  },
  '/curriculum': {
    title: 'Spoken English Curriculum & English Grammar in Kannada | SIMPLISH Talks',
    description: 'Structured Kannada to English learning curriculum. Master basic English grammar in Kannada, sentence formation, tenses, daily conversations, and workplace English.',
  },
  '/discover': {
    title: 'English Vocabulary Builder & Learn English Words in Kannada | SIMPLISH Talks',
    description: 'Interactive visual vocabulary builder, daily English words with Kannada meanings, image practice, and conversational phrases for beginners.',
  },
  '/login': {
    title: 'Login | SIMPLISH Talks - Learn English through Kannada',
    description: 'Sign in to your SIMPLISH Talks account to continue your spoken English practice and AI conversation sessions.',
  },
  '/register': {
    title: 'Start Learning Spoken English through Kannada Free | SIMPLISH Talks',
    description: 'Create your account on SIMPLISH Talks. Start practicing spoken English from zero using Kannada with your AI companion Snehi.',
  },
  '/placement': {
    title: 'English Speaking Placement Test | Assess Spoken English | SIMPLISH Talks',
    description: 'Take our quick English proficiency placement test to evaluate your English speaking level and receive a custom learning roadmap.',
  },
  '/dashboard': {
    title: 'My English Learning Dashboard | SIMPLISH Talks',
    description: 'Track your spoken English fluency progress, access daily vocabulary lessons, and launch instant practice with your AI English teacher.',
  },
  '/talk': {
    title: 'AI English Tutor & Voice Speaking Practice | Practice English Speaking | SIMPLISH Talks',
    description: 'Have real-time 24/7 spoken English practice with AI Companion Snehi. Speak English fluently without fear of mistakes or judgment.',
  },
  '/coachchat': {
    title: 'AI Spoken English Coach & Grammar Practice Chat | SIMPLISH Talks',
    description: 'Chat with your AI language coach for instant English grammar explanations in Kannada, sentence corrections, and vocabulary guidance.',
  },
  '/settings': {
    title: 'Account Settings | SIMPLISH Talks',
    description: 'Manage your profile preferences, language settings, and account options.',
  },
};

export const SEOHead: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    const seo = ROUTE_SEO[pathname] || {
      title: 'SIMPLISH Talks | Learn English through Kannada with AI',
      description: 'Learn English through Kannada with SIMPLISH Talks. Practice speaking with AI, improve grammar, vocabulary and confidence.',
    };

    // Update Document Title
    document.title = seo.title;

    // Update Meta Description
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = seo.description;
    }

    // Update Open Graph Tags
    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = seo.title;

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = seo.description;

    const fullUrl = `https://talks.simplish.in${pathname === '/' ? '' : pathname}`;
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = fullUrl;

    // Update Twitter Tags
    let twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = seo.title;

    let twitterDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.content = seo.description;

    // Update Canonical URL
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      canonical.href = fullUrl;
    }
  }, [location.pathname]);

  return null;
};

export default SEOHead;
