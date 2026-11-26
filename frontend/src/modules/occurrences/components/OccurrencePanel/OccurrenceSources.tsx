import { ExternalLink } from "lucide-react";
import type { Article } from "@/entities/article/article.types";
import { validSourceUrl } from "../../utils/occurrence-presentation";

export function OccurrenceSources({ articles, compact = false }: { articles: Article[]; compact?: boolean }) {
  return articles.map((article, index) => {
    const url = validSourceUrl(article.url);
    if (compact && !url) return null;
    return (
      <div key={`${article.id}-${index}`} className={compact ? "" : "space-y-1 border border-border bg-muted/20 p-3"}>
        {!compact && (
          <>
            <p className="text-sm font-medium">{article.title}</p>
            {article.doi && (
              <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                DOI: {article.doi}<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              </a>
            )}
            <p className="text-xs text-muted-foreground">
              {[article.authors?.join(", "), article.journal, article.year > 0 ? article.year : undefined]
                .filter(Boolean).join(" · ")}
            </p>
            {article.type && article.type !== "outro" && <p className="text-xs text-muted-foreground">{article.type}</p>}
          </>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            title={article.title}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            {compact && articles.length > 1 ? `Abrir fonte ${index + 1}` : "Abrir fonte"}
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        )}
      </div>
    );
  });
}
