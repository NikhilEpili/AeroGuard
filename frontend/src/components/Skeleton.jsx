export function Skeleton({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />;
}

export function SkeletonText({ lines = 2, lineClassName = "h-3" }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={`${lineClassName} ${
            idx === lines - 1 ? "w-3/5" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}