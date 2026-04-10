# Feature Specification: Multi-User Household Accounts & Shared Meal Logs

**Feature Branch**: `003-multi-user-accounts`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Currently we are recording 1 user log, so we are not considering users living together and sharing food. This might be a key information to have a better recommendation system for multiple users. The idea is that each user has its own account and be able to see the shared meal log, request a shared and individual meal log"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create or Join a Household (Priority: P1)

A user creates a household group and invites people they live with (family members, roommates) to join it. Once accepted, all members of the household can share meal logs and have their individual eating history visible to each other within the group.

**Why this priority**: The household is the foundational entity that unlocks all shared meal features. Without it, there is no context in which to share logs or generate joint recommendations. No other story in this spec is possible without a household being established first.

**Independent Test**: Can be fully tested by one user creating a household, another user accepting the invite, and verifying both users appear in the household member list.

**Acceptance Scenarios**:

1. **Given** a registered user with no household, **When** they create a household with a name (e.g., "Casa García"), **Then** the household is created and they are designated as its admin.
2. **Given** a household admin, **When** they invite another registered user by email, **Then** the invited user receives an invitation they can accept or decline.
3. **Given** an invited user, **When** they accept the invitation, **Then** they are added as a member of the household and can access its shared meal history.
4. **Given** an invited user, **When** they decline the invitation, **Then** their status remains unchanged and no data is shared.
5. **Given** a registered user, **When** they belong to a household and then leave it, **Then** their individual meal history and the shared meal history added while was in the household remains intact and no longer appears in the household group.

---

### User Story 2 — Log a Shared Meal (Priority: P2)

A user logs a meal and marks it as shared, indicating that one or more household members also ate the same meal. All members listed in the shared meal see it appear in both the household's shared log and in their own individual history.

**Why this priority**: Shared meal logging is the core value differentiator of this feature. It prevents the common friction of duplicate data entry when family members or roommates eat together, and ensures that household-wide eating patterns are captured for richer recommendations.

**Independent Test**: Can be fully tested by a user in a household logging a shared lunch, selecting one other member as a co-eater, and verifying the meal appears in both users' histories.

**Acceptance Scenarios**:

1. **Given** a user in a household, **When** they log a meal and select one or more household members as co-eaters, **Then** the meal is recorded as shared and appears in every selected member's individual meal history.
2. **Given** a shared meal is logged, **When** any member of the household views the shared log, **Then** the meal is listed showing all members who ate it.
3. **Given** a user in a household, **When** they log a meal without selecting co-eaters, **Then** the meal is recorded as individual and appears only in their own history.
4. **Given** a shared meal is logged, **When** the original logger deletes it, **Then** it is removed from the shared log and from all co-eaters' individual histories, after explicit confirmation.
5. **Given** a user not in any household, **When** they log a meal, **Then** the meal is individual by default and no sharing options are presented.

---

### User Story 3 — View Shared Meal History (Priority: P3)

A user views the household's shared meal log — a chronological feed of all meals tagged as shared by any member of the household. They can distinguish individual entries from shared ones, and see who logged each meal.

**Why this priority**: Visibility into the household's combined eating history builds awareness of shared food patterns and supports both individual accountability and group recommendations. It also reinforces the value of the household feature.

**Independent Test**: Can be fully tested by logging three meals (two shared, one individual) and verifying that the shared log shows only the two shared meals, correctly attributed to the logging member.

**Acceptance Scenarios**:

1. **Given** a household with multiple members who have logged shared meals, **When** any member views the household shared log, **Then** they see all shared meals in reverse chronological order, each showing who logged it and who else ate it.
2. **Given** a member views the shared log, **When** a shared meal appears, **Then** the log clearly shows all co-eaters' names for that entry.
3. **Given** a member views their own individual history, **When** they have both individual and shared meals, **Then** both types appear in their personal log, with shared meals visually distinguished.
4. **Given** no shared meals have been logged yet in the household, **When** a member views the shared log, **Then** an empty state message encourages them to log the next meal as shared.

---

### User Story 4 — Personalized Recommendations Using Shared Data (Priority: P4)

The recommendation system considers both a user's individual meal history and the household's shared meal history when generating a personal meal plan. The user can explicitly request a recommendation based on individual history only, or household history only.

**Why this priority**: This is the primary motivation for the feature (per the issue). Better recommendations through shared data is the end goal; the preceding stories are enablers. It is lower priority because it builds on all the others being implemented first.

**Independent Test**: Can be fully tested by a household of two users with shared meals, asking the assistant "suggest dinner considering what we've eaten this week at home" and verifying the recommendation references shared meals from other household members.

**Acceptance Scenarios**:

1. **Given** a user in a household with shared meal history, **When** they ask the assistant for a meal recommendation, **Then** the assistant defaults to considering both their individual history and the household's shared log.
2. **Given** a user, **When** they ask for a recommendation "based only on my own meals", **Then** the assistant generates a recommendation using only that user's individual meal log.
3. **Given** a user, **When** they ask for a recommendation "for the household" or "for everyone", **Then** the assistant considers the combined meal history of all household members and suggests meals suitable for the group.
4. **Given** a user not in any household, **When** they request recommendations, **Then** recommendations use only their individual history (unchanged behavior from current system).

---

### Edge Cases

- What happens when a user is invited to a household but the invite link expires before they act on it?
    - Answer: the user should dismiss or accept the invitation
- How does the system handle a user who belongs to multiple households (e.g., split custody family)?
    - Answer: User can have a defautl household, if belongs to only one it is selected by default.
    - if the user belongs to a household and wants to record a meal, it can change the group to "JustMe"
    - If the user belongs to a household and wants to select what users from the group, it can click on more option button to individually select the members
- What if a household admin leaves the household — who becomes the new admin?
    - Answer: The oldest member available
    - If no other member exists, the group gets deleted
- What happens to shared meals if a member is removed from the household — do those meals remain in non-member users' histories?
    - Yes, as they were record while it was a member of the group
- What if a user logs a shared meal for a co-eater who then leaves the household before viewing it?
    - When a user records a meal to a group, the meals get recorded for the selected users at that point
- How are recommendations handled when household members have conflicting dietary restrictions (e.g., one is vegetarian, one is not)?
    - That should be specify in diet guidelines. When creating a diet guidelines there should be a reminder for this
    - If not specified as guideline, the meal recomendation should try to find a mid point for users
    - If no midpoint is possible or user specifies, separete recommendations should be made for uncompatible sides, mains, etc of the meal
- What if a shared meal log for the household is very large — how is pagination handled in the shared feed?
    - Shared feed should be paginated. But that is not a goal for this spec
- What if an user made a mistake while recording the meal by adding it for a household member but in the reality that member hasn't participated on that meal ?
    - Affected user can override that meal for itself or simple dismiss it

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A registered user MUST be able to create a new household with a display name, becoming its admin upon creation.
- **FR-002**: A household admin MUST be able to invite other registered users to their household by email address.
- **FR-003**: An invited user MUST be able to accept or decline a household invitation; declining produces no side effects.
- **FR-004**: A household member MUST be able to leave a household at any time; their individual meal history and the shared history while belong to the household MUST be preserved.
- **FR-005**: When a user logs a meal, they MUST be able to optionally select one or more household members as co-eaters, marking the meal as shared.
- **FR-006**: A shared meal MUST appear in the individual meal history of every user listed as a co-eater, including the user who logged it.
- **FR-007**: The system MUST provide a shared household meal log — a unified, chronological view of all meals tagged as shared within the household.
- **FR-008**: Individual meal logs MUST continue to work exactly as today for users with no household, with no change in behavior.
- **FR-009**: A user MUST be able to view their own individual meal history filtered to show only their personal (non-shared) entries, or all entries (individual + shared).
- **FR-010**: The AI recommendation engine MUST support three scopes: individual history only, household shared history only, or combined (individual + shared) — defaulting to combined for household members.
- **FR-011**: The system MUST enforce data isolation: users outside a household MUST NOT be able to read any meals or member data belonging to that household.
- **FR-012**: Only the user who logged a shared meal MUST be able to delete it; deletion removes the entry from all co-eaters' histories, after explicit confirmation.
- **FR-013**: A household admin MUST be able to remove a member from the household; removed members' individual logs are unaffected.
- **FR-014**: A group member can delete a shared meal only for itself, the recorded meal will still appear for the other specified members.
- **FR-015**: A registered user can invite to another user by using its email, doesnt matter if the user does not exists on the app. When the invited member registers in the app can see the invitation

### Key Entities

- **Household**: A named group of users who live together and optionally share meals. Has one admin and any number of members.
- **Household Member**: A registered user belonging to a household, with a role (admin or member) and membership status (pending, active).
- **Shared Meal Log Entry**: A meal log entry attributed to two or more users simultaneously. Has a single logging author and a list of co-eaters. Linked to a household.
- **Individual Meal Log Entry**: A meal log entry attributed to a single user, unchanged from the current model.
- **Recommendation Scope**: The boundary of meal history used to generate AI recommendations — individual, household-shared, or combined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a household and invite a member in under 2 minutes from account login.
- **SC-002**: A user can log a shared meal (selecting co-eaters) in no more than 5 additional seconds compared to logging an individual meal.
- **SC-003**: The shared household meal log correctly reflects 100% of meals tagged as shared by any member, with no individual-only meals included.
- **SC-004**: A user with no household sees no change in any existing behavior — all individual flows work identically to the current system.
- **SC-005**: AI meal recommendations for a household member reference at least one shared household meal in their response when shared meals exist, demonstrating the data is being used.
- **SC-006**: Data from one household is never accessible to users outside that household — verified by attempting to query another household's meal log and receiving zero results.

## Assumptions

- Each user can belong to at most one household at a time. Multi-household membership is out of scope for this version.
- Household invitations are sent to the email address and gets recorded in the app. Any notification made externally from the app is out of the scope. If the invited member it doesnt exist, when creates its account can see the invitation
- A household has no maximum member count limit for this version; scaling constraints will be addressed if needed.
- Shared meal logging requires the meal logger to be online — offline/sync scenarios are out of scope.
- Co-eaters on a shared meal cannot independently edit the meal entry; only the original logger can modify or delete it.
- Co eaters can dismiss a recorded meal from another group member
- Historical individual meals logged before a user joins a household remain individual — they are not retroactively shared with the household.
- The recommendation engine uses the combined household history by default, but this default can be overridden per-request through a natural language qualifier (e.g., "just for me" vs. "for all of us").
- Household membership role hierarchy is simple: admin (can invite/remove members) and member (can log/view shared meals). A household has exactly one admin at a time.
- If the household admin leaves or is removed, admin rights automatically transfer to the longest-standing active member.

## Amend
- Admin user can delete / discard an invitation to other member to the household
- Invited members to a household see the admin as unknown. It should appear the name of the admin on the list
- Invited member should not see pending invited members