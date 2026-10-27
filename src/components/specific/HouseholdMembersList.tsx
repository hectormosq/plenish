'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { inviteToHousehold, removeMember, leaveHousehold, cancelInvitation } from '@/actions/households';
import type { HouseholdWithMembers } from '@/actions/households';
import { UserPlus, UserMinus, LogOut, Crown, User, X } from 'lucide-react';
import { theme, alpha } from '@/theme';

// ─── Styled Components ────────────────────────────────────────────────────────

const HouseholdName = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: ${theme.colors.text};
`;

const MemberList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const MemberRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  background: ${theme.colors.surfaceHigh};
  border-radius: ${theme.radii.md};
  border: 1px solid ${theme.colors.border};
`;

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: ${theme.colors.textSecondary};
`;

const RoleBadge = styled.span<{ $isAdmin: boolean }>`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $isAdmin }) => ($isAdmin ? theme.colors.secondary : theme.colors.textMuted)};
`;

const StatusBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 500;
  color: ${theme.colors.primaryBright};
  background: ${alpha(theme.colors.primary, 0.1)};
  border-radius: ${theme.radii.sm};
  padding: 0.1rem 0.4rem;
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.textMuted};
  cursor: pointer;
  padding: 0.3rem;
  border-radius: ${theme.radii.md};
  display: flex;
  align-items: center;
  transition: color 0.2s, background 0.2s;

  &:hover {
    background: ${alpha(theme.colors.danger, 0.1)};
    color: ${theme.colors.danger};
  }

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const InviteForm = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const EmailInput = styled.input`
  flex: 1;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.md};
  padding: 0.5rem 0.75rem;
  color: ${theme.colors.text};
  font-size: 0.875rem;

  &::placeholder { color: ${theme.colors.textMuted}; }
  &:focus { outline: none; border-color: ${theme.colors.primary}; }
`;

const InviteButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: ${theme.colors.primary};
  color: ${theme.colors.onPrimary};
  border: none;
  border-radius: ${theme.radii.md};
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: ${theme.colors.primaryHover}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const LeaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: ${theme.colors.textSecondary};
  border: 1px solid ${theme.colors.borderStrong};
  border-radius: ${theme.radii.md};
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: color 0.2s, border-color 0.2s;

  &:hover { color: ${theme.colors.danger}; border-color: ${theme.colors.danger}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrorText = styled.p`
  color: ${theme.colors.dangerBright};
  font-size: 0.8rem;
  margin: 0;
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  household: HouseholdWithMembers;
}

export function HouseholdMembersList({ household }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentUserIsAdmin = household.currentUserRole === 'admin';

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await inviteToHousehold(household.id, inviteEmail.trim());
        setInviteEmail('');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleRemove = (userId: string) => {
    if (!confirm('Remove this member from the household?')) return;
    startTransition(async () => {
      try {
        await removeMember(household.id, userId);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleCancelInvitation = (memberId: string) => {
    if (!confirm('Cancel this invitation?')) return;
    startTransition(async () => {
      try {
        await cancelInvitation(household.id, memberId);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleLeave = () => {
    if (!confirm(`Leave "${household.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await leaveHousehold(household.id);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div>
      <HouseholdName>{household.name}</HouseholdName>

      <MemberList style={{ marginTop: '0.75rem' }}>
        {household.members.map((member) => (
          <MemberRow key={member.id}>
            <MemberInfo>
              {member.role === 'admin' ? <Crown size={14} style={{ color: theme.colors.secondary }} /> : <User size={14} style={{ color: theme.colors.textMuted }} />}
              <span>{member.display_name ?? member.invited_email ?? 'Unknown'}</span>
              <RoleBadge $isAdmin={member.role === 'admin'}>{member.role}</RoleBadge>
              {member.status === 'pending' && <StatusBadge>pending</StatusBadge>}
            </MemberInfo>
            {currentUserIsAdmin && member.status === 'pending' && (
              <IconButton
                onClick={() => handleCancelInvitation(member.id)}
                disabled={isPending}
                title="Cancel invitation"
              >
                <X size={15} />
              </IconButton>
            )}
            {currentUserIsAdmin && member.status === 'active' && member.role !== 'admin' && (
              <IconButton
                onClick={() => member.user_id && handleRemove(member.user_id)}
                disabled={isPending}
                title="Remove member"
              >
                <UserMinus size={15} />
              </IconButton>
            )}
          </MemberRow>
        ))}
      </MemberList>

      {currentUserIsAdmin && (
        <InviteForm>
          <EmailInput
            type="email"
            placeholder="Invite by email…"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          />
          <InviteButton onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
            <UserPlus size={14} />
            Invite
          </InviteButton>
        </InviteForm>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <LeaveButton onClick={handleLeave} disabled={isPending}>
        <LogOut size={14} />
        Leave Household
      </LeaveButton>
    </div>
  );
}
