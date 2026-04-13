import { DashboardLayout } from '@/app/dashboard/DashboardLayout';

export default function RecipesPage() {
  return (
    <DashboardLayout
      comingSoonSlot={
        <ComingSoonContent
          icon="🍽️"
          title="Recipes"
          description="Discover culturally-relevant recipes tailored to your household's tastes and nutritional goals."
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
          color: '#f0f0f0',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, color: '#6b7280', maxWidth: '400px', lineHeight: 1.6 }}>
        {description}
      </p>
      <span
        style={{
          marginTop: '0.5rem',
          background: 'rgba(72, 199, 142, 0.12)',
          border: '1px solid rgba(72, 199, 142, 0.3)',
          color: '#48c78e',
          borderRadius: '20px',
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
