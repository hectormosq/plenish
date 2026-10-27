import { DashboardLayout } from '@/app/dashboard/DashboardLayout';
import { theme, alpha } from '@/theme';

export default function HistoryPage() {
  return (
    <DashboardLayout
      comingSoonSlot={
        <ComingSoonContent
          icon="📋"
          title="Meal History"
          description="Browse your full meal log, filter by date range, and review nutritional trends over time."
        />
      }
    />
  );
}

function ComingSoonContent({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <h1
        style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          color: theme.colors.text,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, color: theme.colors.textMuted, maxWidth: '400px', lineHeight: 1.6 }}>
        {description}
      </p>
      <span
        style={{
          marginTop: '0.5rem',
          background: alpha(theme.colors.primary, 0.12),
          border: `1px solid ${alpha(theme.colors.primary, 0.3)}`,
          color: theme.colors.primary,
          borderRadius: theme.radii.xl,
          padding: '0.4rem 1rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        COMING SOON
      </span>
    </div>
  );
}
