# Code Review Instructions

When reviewing code, focus on:

## Performance Red Flags

### General

- Spot inefficient loops and algorithmic issues
- Check for memory leaks and resource cleanup
- Review caching opportunities for expensive operations

### React

- Avoid unnecessary re-renders (use `React.memo`, `useCallback`, `useMemo`)
- Optimize component structure and state management
- Lazy load components where appropriate

### TypeScript

- Ensure strict typing and avoid `any` types
- Validate proper use of interfaces and types
- Check for potential runtime type errors

## Code Quality Essentials

- Functions should be focused and appropriately sized
- Use clear, descriptive naming conventions
- Ensure proper error handling throughout

## Review Style

- Be specific and actionable in feedback
- Explain the "why" behind recommendations
- Acknowledge good patterns when you see them
- Ask clarifying questions when code intent is unclear

Always prioritize security vulnerabilities and performance issues that could impact users.

Always suggest changes to improve readability. For example, this suggestion seeks to make the code more readable and also makes the validation logic reusable and testable.

// Instead of:
if (user.email && user.email.includes('@') && user.email.length > 5) {
submitButton.enabled = true;
} else {
submitButton.enabled = false;
}

// Consider:
function isValidEmail(email) {
return email && email.includes('@') && email.length > 5;
}

submitButton.enabled = isValidEmail(user.email);
Focus on providing constructive, respectful feedback that helps maintain high code quality and security standards.
