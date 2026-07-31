import { Star, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { resolveCover } from "@/lib/covers";
import { useCurrency } from "@/lib/currency";
import type { Comic } from "@/lib/catalog.functions";

export function ComicCard({ comic, large = false }: { comic: Comic; large?: boolean }) {
  const cover = resolveCover(comic.cover_url);
  const { format } = useCurrency();
  return (
    <Link
      to="/comics/$slug"
      params={{ slug: comic.slug }}
      className="group relative flex flex-col"
    >
      <div className="relative overflow-hidden rounded-md border border-border bg-card aspect-[2/3] shadow-elegant">
        <img
          src={cover}
          alt={`${comic.title} cover art`}
          loading="lazy"
          width={768}
          height={1152}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent opacity-90" />
        {comic.is_new && (
          <span className="absolute top-3 left-3 rounded-sm bg-gold/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            New
          </span>
        )}
        {/* {comic.publisher && (
          <span className="absolute top-3 right-3 rounded-sm border border-gold-soft bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/90 backdrop-blur">
            {comic.publisher.name}
          </span>
        )} */}
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-gold text-primary-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <Plus className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 px-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={`font-display ${large ? "text-xl" : "text-lg"} leading-tight text-foreground line-clamp-1`}>
            {comic.title}
          </h3>
          <span className="font-mono text-sm text-gold">{format(comic.price, comic as any)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {/* {comic.writer ? `By ${comic.writer}` : comic.format} */}
          {/* {comic.writer ? `By Comic Soar` : comic.format} */}
          {/* {comic.genre && <span> · {comic.genre}</span>} */}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-1 text-xs  text-muted-foreground">
          <div className="mr-auto">{comic.genre && <span> {comic.genre}</span>}</div>
          <span>{comic.rating.toFixed(1)}</span>
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
        </div>
      </div>
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-8">
      <div>
        {eyebrow && (
          <div className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-gold">
            <span className="h-px w-8 bg-gold/60" />
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-3xl md:text-4xl text-foreground">{title}</h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Link to="/shop">
          <button className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors">
            {action} →
          </button>
        </Link>
      )}
    </div>
  );
}
