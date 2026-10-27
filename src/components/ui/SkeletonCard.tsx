'use client';

import styled, { keyframes } from 'styled-components';
import { theme } from '@/theme';

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(90deg, ${theme.colors.surfaceContainer} 25%, ${theme.colors.surfaceHigh} 50%, ${theme.colors.surfaceContainer} 75%);
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
  border-radius: ${theme.radii.md};
`;

const Wrapper = styled.div`
  background-color: ${theme.colors.surfaceContainer};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radii.xl};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Line = styled(SkeletonBase)<{ $width?: string; $height?: string }>`
  width: ${p => p.$width ?? '100%'};
  height: ${p => p.$height ?? '1rem'};
`;

export function SkeletonCard() {
  return (
    <Wrapper>
      <Line $width="40%" $height="1.25rem" />
      <Line $height="200px" />
      <Line $width="70%" $height="1.5rem" />
      <Line $width="50%" />
      <Line />
      <Line $height="2.75rem" />
    </Wrapper>
  );
}
