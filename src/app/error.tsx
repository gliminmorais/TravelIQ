'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-screen">
      <h1>We couldn’t open your workspace.</h1>
      <p>Refresh the page, then try again. Your saved bookings stay in this browser.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
