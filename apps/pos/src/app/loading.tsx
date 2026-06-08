export default function Loading() {
  return (
    <div className="flex h-screen flex-col">
      <div className="h-16 animate-pulse bg-gray-100" />
      <div className="flex flex-1 gap-4 p-6">
        <div className="h-full w-64 animate-pulse rounded-2xl bg-gray-100" />
        <div className="flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
