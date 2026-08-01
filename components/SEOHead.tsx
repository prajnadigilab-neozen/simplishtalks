import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteSEO {
  title: string;
  description: string;
}

const ROUTE_SEO: Record<string, RouteSEO> = {
  '/': {
    title: 'SIMPLISH Talks | Learn English through Kannada with AI',
    description: 'Learn English through Kannada with SIMPLISH Talks. Practice speaking with AI, improve grammar, vocabulary and confidence through bilingual coaching designed for Karnataka learners.',
  },
  '/packages': {
    title: 'Pricing & Packages | SIMPLISH Talks',
    description: 'Explore affordable plans for SIMPLISH Talks and AI companion Snehi. Unlock spoken English practice, voice feedback, and structured lessons.',
  },
  '/curriculum': {
    title: 'English Learning Curriculum | SIMPLISH Talks',
    description: 'Structured English learning path for Kannada speakers. Browse basic to advanced speaking modules, daily scenarios, and interview practice.',
  },
  '/discover': {
    title: 'Visual English Learning & Vocabulary | SIMPLISH Talks',
    description: 'Bite-sized visual learning cards, jokes, facts, and image description practice to enhance your English vocabulary through Kannada.',
  },
  '/login': {
    title: 'Login | SIMPLISH Talks',
    description: 'Sign in to your SIMPLISH Talks account to continue your English speaking journey.',
  },
  '/register': {
    title: 'Create Account | SIMPLISH Talks',
    description: 'Join SIMPLISH Talks today. Start practicing spoken English through Kannada with your AI companion Snehi.',
  },
  '/placement': {
    title: 'English Placement Test | SIMPLISH Talks',
    description: 'Assess your English proficiency level and get a customized learning roadmap.',
  },
  '/dashboard': {
    title: 'My Learning Dashboard | SIMPLISH Talks',
    description: 'Track your speaking progress, access recent lessons, and practice with AI.',
  },
  '/talk': {
    title: 'Practice with Snehi AI | SIMPLISH Talks',
    description: 'Have real-time voice conversations with Snehi AI to build natural English speaking confidence.',
  },
  '/coachchat': {
    title: 'AI Coach Chat | SIMPLISH Talks',
    description: 'Chat with your AI coach for personalized English grammar and vocabulary guidance.',
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
