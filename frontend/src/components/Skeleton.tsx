type SkeletonVariant = "line" | "title" | "cover" | "bubble";

type SkeletonProps = {
  variant?: SkeletonVariant;
  className?: string;
  width?: string | number;
  height?: string | number;
};

export function Skeleton({ variant = "line", className = "", width, height }: SkeletonProps) {
  const style = {
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };
  return (
    <span
      className={`sk sk-${variant}${className ? ` ${className}` : ""}`}
      style={Object.keys(style).length ? style : undefined}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <article className="card skeleton" aria-hidden>
      <Skeleton variant="cover" className="cover" />
      <div className="card-body">
        <Skeleton variant="title" />
        <Skeleton />
        <Skeleton />
      </div>
    </article>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  const n = Math.max(1, Math.min(6, count));
  return (
    <>
      {Array.from({ length: n }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </>
  );
}

export function SkeletonThread() {
  return (
    <ol className="thread skeleton-thread" aria-hidden>
      <li className="bubble-row is-user">
        <Skeleton variant="bubble" width="44%" height="2.5rem" />
      </li>
      <li className="bubble-row is-bot">
        <Skeleton variant="bubble" width="78%" height="4.6rem" />
      </li>
    </ol>
  );
}
