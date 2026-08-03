import { Star, Plus, Heart, Share2, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveCover } from "@/lib/covers";
import { useCurrency } from "@/lib/currency";
import type { Comic } from "@/lib/catalog.functions";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ComicCard({ comic, large = false }: { comic: Comic; large?: boolean }) {
  const cover = resolveCover(comic.cover_url);
  const { format } = useCurrency();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isMobile) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const handleMouseEnter = () => setIsHovered(true);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <Link
      to="/comics/$slug"
      params={{ slug: comic.slug }}
      className="group relative flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <motion.div
        ref={cardRef}
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={!isMobile ? { y: -8 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="relative overflow-hidden rounded-lg md:rounded-xl border border-border bg-card aspect-[2/3] shadow-elegant transition-shadow duration-500 group-hover:shadow-2xl">
          {/* 3D Tilt Effect */}
          <div
            className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-300"
            style={{
              background: !isMobile ? `radial-gradient(circle at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, rgba(255,215,0,0.1) 0%, transparent 70%)` : 'none',
              opacity: isHovered ? 1 : 0,
            }}
          />

          {/* Image with Parallax */}
          <motion.div
            className="h-full w-full"
            animate={{
              scale: isHovered ? 1.08 : 1,
              rotateX: !isMobile ? mousePosition.y * -4 : 0,
              rotateY: !isMobile ? mousePosition.x * 4 : 0,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          >
            <img
              src={cover}
              alt={`${comic.title} cover art`}
              loading="lazy"
              width={768}
              height={1152}
              className={`h-full w-full object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              onLoad={() => setIsLoaded(true)}
            />
            {/* Skeleton Loader */}
            {!isLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-card via-border to-card animate-pulse" />
            )}
          </motion.div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-95" />

          {/* Quick Actions - Top */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {comic.is_new && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                  className="rounded-sm bg-gradient-to-r from-gold to-gold-light px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-lg"
                >
                  <Sparkles className="inline h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5 sm:mr-1" />
                  New
                </motion.span>
              )}
              {comic.is_bestseller && (
                <span className="rounded-sm bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                  Bestseller
                </span>
              )}
            </div>
            <div className="flex gap-1 sm:gap-1.5">
              <motion.button
                onClick={toggleFavorite}
                className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70 hover:text-white transition-all duration-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              </motion.button>
              <motion.button
                className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70 hover:text-white transition-all duration-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </motion.button>
            </div>
          </div>

          {/* Add to Cart Button - Bottom */}
          <motion.div
            className="absolute bottom-3 right-3 z-10"
            initial={{ scale: 0 }}
            animate={{ scale: isHovered ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <motion.button
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-gold text-primary-foreground shadow-lg hover:bg-gold-light transition-colors"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Handle add to cart
              }}
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>
          </motion.div>

          {/* Progress Bar - Reading Status */}
          {comic.reading_progress !== undefined && comic.reading_progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{ width: `${comic.reading_progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Comic Info */}
        <div className="mt-2 sm:mt-3 px-0.5">
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <h3 className={`font-display leading-tight text-foreground line-clamp-1 group-hover:text-gold transition-colors lowercase ${large
              ? 'text-[14px] xs:text-base sm:text-lg md:text-xl lg:text-[14px]'
              : `text-[12px] xs:text-sm sm:text-base ${comic.title.length > 20 ? 'md:text-[14px]' : 'md:text-[15px]'}`
              }`}>
             <span className="capitalize">{comic.title}</span>
            </h3>
            <motion.span
              className="font-mono text-[11px] xs:text-xs sm:text-sm md:text-base text-gold whitespace-nowrap flex-shrink-0"
              whileHover={{ scale: 1.05 }}
            >
              {format(comic.price, comic as any)}
            </motion.span>
          </div>

          {/* Creator - Left side, Genre - Right side */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Rating & Metadata */}
            <div className="mt-0.5 sm:mt-1.5 flex items-center justify-between gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-gold text-gold" />
                <span className="font-medium">{comic.rating.toFixed(1)}</span>
                <span className="hidden xs:inline">({comic.review_count || 0})</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {comic.pages && (
                  <>
                    <span className="hidden sm:inline">{comic.pages} pgs</span>
                    <span className="sm:hidden">{comic.pages}p</span>
                  </>
                )}
                {comic.year && (
                  <>
                    <span className="hidden xs:inline">·</span>
                    <span className="hidden xs:inline">{comic.year}</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-0.5 sm:mt-1 flex items-center justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground">
              {/* <span className="line-clamp-1 flex-1">
              {comic.creator || comic.format || "Comic"}
              </span> */}
              {comic.genre && (
                <span className="px-1.5 py-0.5 rounded-sm bg-card/50 border border-border/50 text-[8px] sm:text-[10px] uppercase tracking-wider flex-shrink-0">
                  {comic.genre}
                </span>
              )}
            </div>

          </div>

          {/* Mobile Quick Actions */}
          <div className="mt-1.5 sm:mt-2 flex items-center gap-2 md:hidden">
            <button
              className="flex-1 rounded-full bg-gold/10 px-3 py-1.5 text-[10px] sm:text-xs font-medium text-gold hover:bg-gold/20 active:bg-gold/30 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Handle add to cart
              }}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  actionLink = "/shop",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: string;
  actionLink?: string;
}) {
  return (
    <div className="flex flex-col xs:flex-row xs:items-end justify-between gap-3 xs:gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8 lg:mb-10">
      <div className="space-y-1">
        {eyebrow && (
          <motion.div
            className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-gold"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="h-px w-6 sm:w-8 bg-gold/60" />
            {eyebrow}
          </motion.div>
        )}
        <motion.h2
          className="font-display text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {title}
        </motion.h2>
        {description && (
          <motion.p
            className="mt-0.5 sm:mt-1 max-w-xl text-xs sm:text-sm md:text-base text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {description}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-3 flex-shrink-0"
        >
          <Link to={actionLink}>
            <button className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-gold transition-colors group whitespace-nowrap">
              {action}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </Link>
          <div className="hidden md:flex h-px w-8 lg:w-12 bg-gradient-to-r from-gold/60 to-transparent" />
        </motion.div>
      )}
    </div>
  );
}