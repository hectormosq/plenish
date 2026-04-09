import React from 'react';
import { getHousehold, getPendingInvitations } from '@/actions/households';
import { HouseholdMembersList } from './HouseholdMembersList';
import { PendingInvitationBanner } from './PendingInvitationBanner';
import { CreateHouseholdForm } from './CreateHouseholdForm';
import { Card, CardTitle } from '@/components/ui/Card';
import { Home } from 'lucide-react';

export async function HouseholdPanel() {
  const [household, pendingInvites] = await Promise.all([
    getHousehold(),
    getPendingInvitations(),
  ]);

  return (
    <Card>
      <CardTitle>
        <Home size={20} color="#3b82f6" />
        Household
      </CardTitle>

      {pendingInvites.length > 0 && pendingInvites.map((invite) => (
        <PendingInvitationBanner
          key={invite.household_id}
          householdId={invite.household_id}
          householdName={invite.household_name}
          invitedBy={invite.invited_by}
        />
      ))}

      {household ? (
        <HouseholdMembersList household={household} />
      ) : (
        pendingInvites.length === 0 && <CreateHouseholdForm />
      )}
    </Card>
  );
}
