# Plenish Product Specification

## Overview
Plenish is an AI-powered meal tracking and recommendation web application. Its primary goal is to allow users to log their daily meals easily and use that historical data to generate culturally-relevant, personalized weekly meal plans. Focus is placed on Spanish-language cuisine natively, but the data schema fully supports English.

## Core Features
1. **Meal Logging (CRUD)**
   - Users can register daily meals (Breakfast, Lunch, Dinner, Snacks).
   - Easy input via natural language (leveraging Vercel AI) or structured forms.
   - Record ingredients, portions, or simply the dish name and a description.

2. **Meal Recommendations (Agentic AI)**
   - Generate automated weekly meal plans based on previously eaten meals and saved preferences.
   - User handles "on-demand" updates: replacing a specific meal on a given day, modifying portions, or asking the AI for an alternative recommendation.
   - Leverage `pgvector` similarity search to propose meals the user already likes or introduce new variations.

3. **Multi-language Support (i18n)**
   - Content handling for English and Spanish.
   - Recipes and user prompts natively handle Spanish inputs and format Spanish outputs naturally.

## User Roles
- **Guest Explorer:** Can view a sample weekly plan, but cannot customize without an account.
- **Registered User:** Can save history, receive hyper-customized meal recommendations, track logs safely in Supabase.

## Styling & UX Vision
- A responsive, app-like experience using `styled-components` to offer sleek transitions, hover effects, and a dynamic dark mode interface (premium aesthetic).
- Focus on Vercel AI SDK generative UI: streaming complete react components showing meal cards directly in an AI chat interface.
