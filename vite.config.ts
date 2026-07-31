// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sitemapPlugin } from '@corentints/tanstack-router-sitemap';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Comic {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  release_date: string | null;
  genre: string | null;
  synopsis: string | null;
  status: string;
  writer: string | null;
  artist: string | null;
}

// ============================================
// NO CACHE - FETCH FRESH DATA
// ============================================

async function getComicData(): Promise<Comic[]> {
  console.log("🔄 [Sitemap] Fetching FRESH comic data from Supabase...");
  
  try {
    const { supabaseAdmin } = await import('./src/integrations/supabase/client.server');
    
    const { data: comics, error } = await supabaseAdmin
      .from("comics")
      .select("slug, release_date, title, cover_url, genre, synopsis, writer, artist")
      .eq("status", "published")
      .order("release_date", { ascending: false });
    
    if (error) {
      console.error("❌ [Sitemap] Supabase error:", error);
      return [];
    }
    
    if (!comics || comics.length === 0) {
      console.warn("⚠️ [Sitemap] No published comics found");
      return [];
    }
    
    console.log(`✅ [Sitemap] Fetched ${comics.length} FRESH comics`);
    
    if (comics.length > 0) {
      const sample = comics[0];
      console.log("📝 [Sitemap] Sample comic:", {
        title: sample.title,
        slug: sample.slug,
        genre: sample.genre || 'Not set',
        synopsis: sample.synopsis ? sample.synopsis.substring(0, 50) + '...' : 'Not set',
        hasCover: !!sample.cover_url,
      });
    }
    
    return comics as Comic[];
  } catch (error) {
    console.error("❌ [Sitemap] Failed to fetch comics:", error);
    return [];
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: string | null): string {
  if (!date) return new Date().toISOString();
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.warn(`⚠️ [Sitemap] Invalid date detected: ${date}, using today`);
    return new Date().toISOString();
  }
  
  const today = new Date();
  if (dateObj > today) {
    console.warn(`⚠️ [Sitemap] Future date detected: ${date}, using today`);
    return today.toISOString();
  }
  
  return dateObj.toISOString();
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://comicsoar.com${url}`;
  return `https://comicsoar.com/${url}`;
}

// ============================================
// BUILD CAPTION & DESCRIPTION USING SYNOPSIS
// ============================================

function buildImageCaption(comic: Comic): string {
  const parts = [];
  
  // 1. Title - ALWAYS included
  if (comic.title) parts.push(comic.title);
  
  // 2. Genre - if available
  if (comic.genre) parts.push(`Genre: ${comic.genre}`);
  
  // 3. Writer - if available
  if (comic.writer) parts.push(`Writer: ${comic.writer}`);
  
  // 4. Artist - if available
  if (comic.artist) parts.push(`Artist: ${comic.artist}`);
  
  // 5. Synopsis - THE MAIN DESCRIPTION (truncated to 200 chars for image caption)
  if (comic.synopsis) {
    const synopsis = truncateText(comic.synopsis, 200);
    if (synopsis) parts.push(synopsis);
  }
  
  // Fallback if only title exists
  if (parts.length === 1 && parts[0] === comic.title) {
    return `${comic.title} - Available at ComicSoar`;
  }
  
  return parts.join(' - ');
}

// ============================================
// SITEMAP CONFIGURATION - WITH IMAGES & SYNOPSIS
// ============================================

const sitemapConfig = {
  baseUrl: 'https://comicsoar.com',
  outputPath: 'public/sitemap.xml',
  verbose: true,
  
  // Exclude private routes
  excludeRoutes: [
    '/auth',
    '/account',
    '/cart',
    '/checkout',
    '/checkout/*',
    '/library',
    '/admin',
    '/admin/*',
    '/api',
    '/api/*',
    '/resizer',
  ],
  
  // Static route overrides
  routeOptions: {
    '/': {
      priority: 1.0,
      changefreq: 'daily',
    },
    '/shop': {
      priority: 0.9,
      changefreq: 'daily',
    },
    '/support': {
      priority: 0.5,
      changefreq: 'monthly',
    },
    '/about': {
      priority: 0.5,
      changefreq: 'monthly',
    },
    '/contact': {
      priority: 0.4,
      changefreq: 'monthly',
    },
    '/terms': {
      priority: 0.3,
      changefreq: 'yearly',
    },
    '/privacy': {
      priority: 0.3,
      changefreq: 'yearly',
    },
  },
  
  // Manual routes with images and synopsis
  manualRoutes: async () => {
    console.log("🏗️ [Sitemap] Building manual routes with images and synopsis...");
    const comics = await getComicData();
    
    const comicRoutes = comics.map(comic => {
      // Build the route
      const route: any = {
        location: `/comic/${comic.slug}`,
        priority: 0.8,
        changeFrequency: 'weekly' as const,
        lastMod: formatDate(comic.release_date),
      };
      
      // Add image if cover_url exists - using synopsis for caption
      if (comic.cover_url) {
        const imageUrl = getImageUrl(comic.cover_url);
        if (imageUrl) {
          route.images = [{
            loc: imageUrl,
            title: comic.title || 'Comic',
            // ✅ Caption uses title, genre, writer, artist, and SYNOPSIS
            caption: buildImageCaption(comic),
          }];
        }
      }
      
      return route;
    });
    
    console.log(`✅ [Sitemap] Built ${comicRoutes.length} comic routes with images and synopsis`);
    
    // Log first few entries with synopsis preview
    comicRoutes.slice(0, 3).forEach((route, i) => {
      const caption = route.images?.[0]?.caption || 'No caption';
      console.log(`📝 [Sitemap] Route ${i + 1}:`, {
        location: route.location,
        hasImage: !!route.images,
        captionPreview: caption.substring(0, 80) + '...',
        lastMod: route.lastMod,
      });
    });
    
    return comicRoutes;
  },
};

// ============================================
// EXPORT CONFIG
// ============================================

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: { 
    // plugins: [
    //   sitemapPlugin(sitemapConfig)
    // ]
  }
});