/** Full-screen, text-free loader shown while the 3D chunk downloads (no three.js imports here). */
export function SceneLoader() {
  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-0 grid place-items-center bg-bg">
      <span aria-hidden="true" className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block size-3 animate-pulse rounded-[2px] bg-ember" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}
