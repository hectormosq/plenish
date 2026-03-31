'use client';

import styled from 'styled-components';
import { Card, CardTitle } from '@/components/ui/Card';
import { Utensils, Clock, CheckCircle } from 'lucide-react';
import React from 'react';

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #1f2937, #374151);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9cd1b5;
  font-size: 1.25rem;
  font-weight: bold;
  margin-top: 1rem;
`;

const DetailRow = styled.div`
  display: flex;
  gap: 1.5rem;
  color: #a3a3a3;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  
  & > span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const LogButton = styled.button`
  margin-top: 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2563eb;
  }
`;

export function CurrentRecommendation() {
  const handleLogClick = () => {
    alert("Logged! (This will eventually save to public.meal_logs)");
  };

  return (
    <Card>
      <CardTitle>
        <Utensils size={20} color="#3b82f6" /> 
        Next Meal: Dinner
      </CardTitle>

      <ImagePlaceholder>
        Enchiladas Suizas Mockup
      </ImagePlaceholder>

      <h3 style={{ margin: '1rem 0 0.25rem 0', color: '#fff', fontSize: '1.5rem' }}>
        Enchiladas Suizas
      </h3>
      
      <DetailRow>
        <span><Clock size={16} /> 45 min prep</span>
        <span>520 kcal</span>
      </DetailRow>
      
      <p style={{ color: '#d4d4d8', marginTop: '1rem', lineHeight: '1.5' }}>
        Recommended based on your recent Chicken consumption goal and preference for spicy cheese dishes!
      </p>

      <LogButton onClick={handleLogClick}>
        <CheckCircle size={18} /> Mark as Eaten
      </LogButton>
    </Card>
  );
}
