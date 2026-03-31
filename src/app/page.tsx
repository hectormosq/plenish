import { redirect } from 'next/navigation';

// Root page redirects to dashboard (middleware will handle auth check)
export default function Home() {
  redirect('/dashboard');
}
