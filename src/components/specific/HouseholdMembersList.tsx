'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { inviteToHousehold, removeMember, leaveHousehold, cancelInvitation } from '@/actions/households';
import type { HouseholdWithMembers } from '@/actions/households';
import { UserPlus, UserMinus, LogOut, Crown, User, X } from 'lucide-react';

// ─── Styled Components ────────────────────────────────────────────────────────

const HouseholdName = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #f5f5f5;
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
  background: #222;
  border-radius: 8px;
  border: 1px solid #2d2d2d;
`;

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #d1d5db;
`;

const RoleBadge = styled.span<{ $isAdmin: boolean }>`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${({ $isAdmin }) => ($isAdmin ? '#fbbf24' : '#6b7280')};
`;

const StatusBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 500;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.2s, background 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
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
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  color: #f5f5f5;
  font-size: 0.875rem;

  &::placeholder { color: #555; }
  &:focus { outline: none; border-color: #3b82f6; }
`;

const InviteButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #2563eb; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const LeaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: #9ca3af;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: color 0.2s, border-color 0.2s;

  &:hover { color: #ef4444; border-color: #ef4444; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrorText = styled.p`
  color: #f87171;
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
              {member.role === 'admin' ? <Crown size={14} color="#fbbf24" /> : <User size={14} color="#6b7280" />}
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
