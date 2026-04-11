'use client';

import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import type { HouseholdMemberSimple } from '@/actions/households';

// ─── Styled Components ────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
`;

const Popover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 50;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 1rem;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
`;

const PopoverTitle = styled.p`
  font-size: 0.75rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
`;

const MemberList = styled.ul`
  list-style: none;
  margin: 0 0 0.75rem 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const MemberItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;

  &:hover label {
    color: #e5e5e5;
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
`;

const MemberLabel = styled.label`
  font-size: 0.875rem;
  color: #ccc;
  cursor: pointer;
  flex: 1;
  user-select: none;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #333;
  margin: 0.75rem 0;
`;

const SelectAllRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  cursor: pointer;

  &:hover label {
    color: #e5e5e5;
  }
`;

const JustMeLink = styled.button`
  background: none;
  border: none;
  color: #888;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: #bbb;
  }
`;

const ConfirmButton = styled.button`
  width: 100%;
  margin-top: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s;

  &:hover {
    background: #2563eb;
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface MemberPickerPopoverProps {
  members: HouseholdMemberSimple[];
  selected: Set<string>;
  onConfirm: (selected: Set<string>) => void;
  onClose: () => void;
}

export function MemberPickerPopover({
  members,
  selected,
  onConfirm,
  onClose,
}: MemberPickerPopoverProps) {
  const [localSelected, setLocalSelected] = React.useState<Set<string>>(
    new Set(selected)
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const allSelected = members.every((m) => localSelected.has(m.user_id));
  const someSelected = members.some((m) => localSelected.has(m.user_id));

  const toggleMember = (userId: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setLocalSelected(new Set());
    } else {
      setLocalSelected(new Set(members.map((m) => m.user_id)));
    }
  };

  const handleJustMe = () => {
    onConfirm(new Set());
  };

  const handleConfirm = () => {
    onConfirm(new Set(localSelected));
  };

  return (
    <>
      <Overlay onClick={onClose} />
      <Popover ref={popoverRef}>
        <PopoverTitle>Who&apos;s eating this?</PopoverTitle>

        {/* Select All row */}
        <SelectAllRow onClick={handleSelectAll}>
          <Checkbox
            type="checkbox"
            id="select-all"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected;
            }}
            onChange={handleSelectAll}
            onClick={(e) => e.stopPropagation()}
          />
          <MemberLabel htmlFor="select-all" style={{ fontWeight: 600, color: '#e5e5e5' }}>
            Everyone
          </MemberLabel>
        </SelectAllRow>

        <Divider />

        {/* Member checkboxes */}
        <MemberList>
          {members.map((member) => (
            <MemberItem key={member.user_id} onClick={() => toggleMember(member.user_id)}>
              <Checkbox
                type="checkbox"
                id={`member-${member.user_id}`}
                checked={localSelected.has(member.user_id)}
                onChange={() => toggleMember(member.user_id)}
                onClick={(e) => e.stopPropagation()}
              />
              <MemberLabel htmlFor={`member-${member.user_id}`}>
                {member.display_name}
              </MemberLabel>
            </MemberItem>
          ))}
        </MemberList>

        <FooterRow>
          <JustMeLink type="button" onClick={handleJustMe}>
            👤 Just me
          </JustMeLink>
          <ConfirmButton type="button" onClick={handleConfirm}>
            Confirm
          </ConfirmButton>
        </FooterRow>
      </Popover>
    </>
  );
}
