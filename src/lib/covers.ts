import cover1 from "@/assets/cover-1.jpg";
import cover2 from "@/assets/cover-2.jpg";
import cover3 from "@/assets/cover-3.jpg";
import cover4 from "@/assets/cover-4.jpg";
import cover5 from "@/assets/cover-5.jpg";
import cover6 from "@/assets/cover-6.jpg";
import cover7 from "@/assets/cover-7.jpg";
import cover8 from "@/assets/cover-8.jpg";

const map: Record<string, string> = {
  "cover-1": cover1,
  "cover-2": cover2,
  "cover-3": cover3,
  "cover-4": cover4,
  "cover-5": cover5,
  "cover-6": cover6,
  "cover-7": cover7,
  "cover-8": cover8,
};

export function resolveCover(key: string | null | undefined): string {
  if (!key) return cover1;
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) return key;
  return map[key] ?? cover1;
}
