// These pages embed server-action reference IDs that are only valid for the
// build that rendered them. Without this, Next statically prerenders them
// (they have no dynamic data) and a browser can hold onto a copy from
// before a deploy, then submit it against a new build whose action manifest
// no longer recognizes that ID ("Server Reference ID did not match the
// expected format"). Forcing dynamic rendering means every request gets a
// fresh page bound to the currently-running build.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
