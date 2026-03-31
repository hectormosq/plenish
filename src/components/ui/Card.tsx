'use client';

import styled from 'styled-components';

export const Card = styled.div`
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #f5f5f5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;
