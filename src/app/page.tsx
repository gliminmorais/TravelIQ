import { applicationMode } from '@/lib/config';
import { actor, HttpError } from '@/lib/server';
import { AuthPanel } from '@/components/auth-panel';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const mode = applicationMode();
  if (mode === 'demo')
    return <Workspace mode="demo" viewer={{ name: 'Demo explorer', role: 'admin' }} />;
  let user: Awaited<ReturnType<typeof actor>> | undefined;
  try {
    user = await actor();
  } catch (e) {
    if (!(e instanceof HttpError && [401, 403].includes(e.status))) throw e;
  }
  if (!user) return <AuthPanel />;
  return (
    <Workspace
      mode="agency"
      viewer={{ name: user.name, role: user.role === 'admin' ? 'admin' : 'staff' }}
    />
  );
}
