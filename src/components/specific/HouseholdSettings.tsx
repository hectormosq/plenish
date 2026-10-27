import React from 'react';
import { getHousehold, getPendingInvitations } from '@/actions/households';
import { HouseholdMembersList } from './HouseholdMembersList';
import { PendingInvitationBanner } from './PendingInvitationBanner';
import { CreateHouseholdForm } from './CreateHouseholdForm';
import { Card, CardTitle } from '@/components/ui/Card';
import { Home, Mail } from 'lucide-react';
import { theme } from '@/theme';

export async function HouseholdSettings() {
  const [household, pendingInvites] = await Promise.all([
    getHousehold(),
    getPendingInvitations(),
  ]);

  return (
    <>
      {pendingInvites.length > 0 && (
        <Card>
          <CardTitle>
            <Mail size={20} style={{ color: theme.colors.secondary }} />
            Pending Invitations
          </CardTitle>
          {pendingInvites.map((invite) => (
            <PendingInvitationBanner
              key={invite.household_id}
              householdId={invite.household_id}
              householdName={invite.household_name}
              invitedBy={invite.invited_by}
            />
          ))}
        </Card>
      )}

      <Card>
        <CardTitle>
          <Home size={20} style={{ color: theme.colors.primary }} />
          Household
        </CardTitle>
        {household ? (
          <HouseholdMembersList household={household} />
        ) : (
          pendingInvites.length === 0 && <CreateHouseholdForm />
        )}
      </Card>
    </>
  );
}
