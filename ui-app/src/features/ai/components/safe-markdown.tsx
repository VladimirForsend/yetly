import { Fragment, type ReactNode } from "react";

function inline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-black text-ink-950">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>,
  );
}

export function SafeMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    const Tag = ordered ? "ol" : "ul";
    nodes.push(<Tag key={`list-${nodes.length}`} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</Tag>);
    list = [];
  };
  lines.forEach((line) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const number = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (bullet || number) {
      const nextOrdered = Boolean(number);
      if (list.length && ordered !== nextOrdered) flush();
      ordered = nextOrdered;
      list.push((bullet ?? number)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const levelClass = heading[1].length === 1 ? "text-lg" : heading[1].length === 2 ? "text-base" : "text-sm";
      nodes.push(<h4 key={`heading-${nodes.length}`} className={`${levelClass} mt-3 font-black text-ink-950`}>{inline(heading[2])}</h4>);
    } else {
      nodes.push(<p key={`paragraph-${nodes.length}`} className="leading-6">{inline(line)}</p>);
    }
  });
  flush();
  return <div className="space-y-2 break-words text-sm text-ink-700">{nodes}</div>;
}
