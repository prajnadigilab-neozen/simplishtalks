# Agent Behavior Rules

## Coding Preferences
1. **Glassmorphism**: Favor `backdrop-blur`, semi-transparent backgrounds, and rounded corners (`rounded-2xl` or `rounded-3xl`).
2. **Type Safety**: Avoid using `any` unless absolutely necessary. Define interfaces in `types.ts`.
3. **Service Layer**: Keep business logic out of components. Use files in `services/`.
4. **State Management**: Prefer the global store (`AppStore`) over individual component states for shared data.

## Linguistic Purity
1. **Linguistic Boundary**: **NEVER INCLUDE ANY OTHER LANGUAGE APART FROM KANNADA AND ENGLISH.** 
2. **Bilingual Formatting**: Always follow the "English Response (Kannada Translation)" format for student-facing AI communications to ensure comprehension.
3. **Translation Accuracy**: Ensure Kannada translations are natural and culturally appropriate for Karnataka rural contexts.
4. **No Halting/Mixing**: Avoid mixing in words from Hindi, Telugu, or other neighboring states.

## Interaction Guidelines
1. **Explain the "Why"**: When modifying complex logic (like RLS or role mappers), explain the technical rationale.
2. **Chunk Large Edits**: If a file is large, prioritize using `replace_file_content` or `multi_replace_file_content` with precise targets.
3. **Proactive Verification**: After creating a feature, proactively offer or perform a build check (`npm run build`).

## Specific Prohibitions
- **No hardcoded roles**: Always use the `UserRole` enum.
- **No plain colors**: Use the defined palette (Blues/Slates for UI, Oranges/Ambers for primary actions).
- **No ignored SQL errors**: If a Supabase query returns an error, it must be handled or logged.
