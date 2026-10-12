'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-screen">
      <h1>We couldn’t open your workspace.</h1>
      <p>Check your connection and agency configuration, then try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
