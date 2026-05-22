'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/super');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans text-muted-foreground text-sm">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
        <span>Redirecting to SuperAdmin console...</span>
      </div>
    </div>
  );
}
