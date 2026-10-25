import { getBakery } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Preorder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;
  const bakery = await getBakery(id);
  const name = bakery?.name || "the bakery";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      {paid ? (
        <>
          <div className="text-6xl">✅</div>
          <h1 className="mt-4 font-display text-3xl text-crust">Order confirmed!</h1>
          <p className="mt-2 text-crust/70">Your afternoon box from {name} is reserved for pickup. See you soon!</p>
        </>
      ) : (
        <>
          <div className="text-6xl">🥐</div>
          <h1 className="mt-4 font-display text-3xl text-crust">Pre-order from {name}</h1>
          <p className="mt-2 text-crust/70">
            Afternoon Rescue box — a fresh pastry + drip coffee, ready for pickup during the quiet hours.
          </p>
          <div className="card mt-6 w-full p-5 text-left">
            <div className="flex justify-between"><span>Afternoon Rescue box</span><span className="font-semibold">$6.00</span></div>
            <p className="mt-3 text-xs text-crust/50">
              This is the QR destination from the generated poster. Add a Stripe key to enable live checkout.
            </p>
          </div>
        </>
      )}
      <a href="/" className="btn-ghost mt-8">← Back to Venice</a>
    </main>
  );
}
