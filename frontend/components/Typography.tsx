import React from "react";

export function TypographyH1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-5xl my-2">
      {children}
    </h1>
  );
}

export function TypographyH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0 my-2">
      {children}
    </h2>
  );
}

export function TypographyH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
      {children}
    </h3>
  );
}

export function TypographyH4({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="scroll-m-20 text-lg font-semibold tracking-tight">
      {children}
    </h4>
  );
}

export function TypographyP({ children }: { children: React.ReactNode }) {
  return (
    <p className="leading-7 text-base [&:not(:first-child)]">{children}</p>
  );
}

export function TypographyBlockquote({
  children,
  ...props
}: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote className="mt-6 border-l-2 pl-6 italic text-base" {...props}>
      {children}
    </blockquote>
  );
}

export function TypographyTable({
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-4 w-full overflow-x-auto" {...props}>
      <table className="w-full border-collapse text-base">{children}</table>
    </div>
  );
}

export function TypographyTh({ children }: { children: React.ReactNode }) {
  return (
    <th className="border px-4 py-2 text-left font-bold text-base">
      {children}
    </th>
  );
}

export function TypographyTd({ children }: { children: React.ReactNode }) {
  return <td className="border px-4 py-2 text-left text-base">{children}</td>;
}

export function TypographyTr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="m-0 border-t p-0 even:bg-muted text-base">{children}</tr>
  );
}

export function TypographyList({
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className="mb-2 ml-6 list-disc [&>li]:mt-2 text-base marker:text-foreground"
      {...props}
    >
      {children}
    </ul>
  );
}

export function TypographyOrderedList({
  children,
  ...props
}: React.HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className="my-2 ml-6 list-decimal [&>li]:mt-2 text-base marker:text-foreground"
      style={{ counterReset: "list-item" }}
      {...props}
    >
      {children}
    </ol>
  );
}

export function TypographyInlineCode({
  children,
  color = "bg-muted",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <code
      className={`relative rounded ${color} px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold break-words whitespace-normal`}
    >
      {children}
    </code>
  );
}

export function TypographyLead({ children }: { children: React.ReactNode }) {
  return <p className="text-xl text-muted-foreground">{children}</p>;
}

export function TypographyLarge({ children }: { children: React.ReactNode }) {
  return <div className="text-lg font-semibold">{children}</div>;
}

export function TypographySmall({ children }: { children: React.ReactNode }) {
  return <small className="text-sm font-medium leading-none">{children}</small>;
}

export function TypographyMuted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function TypographyLi({ children }: { children: React.ReactNode }) {
  return <li className="text-base">{children}</li>;
}
