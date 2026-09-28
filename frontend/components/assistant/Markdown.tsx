"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Markdown ─────────────────────────────────────────────────────────────
   Render an assistant answer as markdown.

   react-markdown escapes raw HTML by default and no `rehype-raw` is added, so
   model output cannot inject markup — the only new surface is link targets,
   which are opened in a new tab with `rel="noreferrer"`.

   There is no typography plugin in this project, so each element is styled here
   with the app's tokens. `remark-gfm` adds tables, strikethrough and task
   lists, which models produce often. */

const components: Components = {
  p: ({ children }) => <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-brand underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  h1: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--border)] pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-[var(--border)]" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--border)] px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-[var(--border)] px-2 py-1">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--card)] p-3 text-xs leading-5">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    // Fenced blocks carry a `language-*` class; everything else is inline.
    const block = typeof className === "string" && className.startsWith("language-");
    if (block) return <code className={className}>{children}</code>;
    return (
      <code className="rounded bg-[var(--card)] px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    );
  },
};

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-6 text-[var(--foreground)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
