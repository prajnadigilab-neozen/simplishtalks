import { create } from 'zustand';
import { VisualContent } from '../types';
import { fetchDiscoveryFeed } from '../services/visualContentService';

interface VisualState {
  feed: VisualContent[];
  activeIndex: number | null;
  loading: boolean;
  error: string | null;
  // Actions
  loadFeed: () => Promise<void>;
  openImage: (index: number) => void;
  closeImage: () => void;
  navigate: (direction: 'next' | 'prev') => void;
}

export const useVisualStore = create<VisualState>((set, get) => ({
  feed: [],
  activeIndex: null,
  loading: false,
  error: null,

  loadFeed: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchDiscoveryFeed(50);
      set({ feed: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  openImage: (index) => {
    set({ activeIndex: index });
  },

  closeImage: () => {
    set({ activeIndex: null });
  },

  navigate: (direction) => {
    const { feed, activeIndex } = get();
    if (activeIndex === null || feed.length === 0) return;

    let nextIndex = activeIndex;
    if (direction === 'next') {
      nextIndex = (activeIndex + 1) % feed.length;
    } else {
      nextIndex = (activeIndex - 1 + feed.length) % feed.length;
    }
    
    set({ activeIndex: nextIndex });
  }
}));
