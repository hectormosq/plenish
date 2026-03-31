'use client';

import styled from 'styled-components';
import { Card, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Target } from 'lucide-react';

const GoalsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1rem;
`;

export function NutritionGoals() {
  return (
    <Card>
      <CardTitle>
        <Target size={20} color="#10b981" />
        Nutrition Goals (This Week)
      </CardTitle>
      
      <GoalsList>
        <ProgressBar
          label="Chicken consumed (Target: 3x)"
          current={2}
          max={3}
          type="target"
        />
        <ProgressBar
          label="Dairy consumed (Target: 5x)"
          current={4}
          max={5}
          type="target"
        />
        <ProgressBar
          label="Alcohol (Limit: 2x)"
          current={2}
          max={2}
          type="limit"
        />
        <ProgressBar
          label="Red Meat (Limit: 1x)"
          current={0}
          max={1}
          type="limit"
        />
      </GoalsList>
    </Card>
  );
}
