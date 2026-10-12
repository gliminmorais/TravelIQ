import { AuthPanel } from '@/components/auth-panel';
import { actor } from '@/lib/server';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Reset() {
  try {
    await actor();
  } catch {
    redirect('/');
  }
  return <AuthPanel reset />;
}
