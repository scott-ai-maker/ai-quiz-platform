# Business Logic Layer - Learning Guide

## The Big Picture: What We Built and Why

Think of your application like a restaurant:

```
Before (Day 5):
Kitchen Storage (Database) ←→ Waiter (API) ←→ Customer

After (Day 6):
Kitchen Storage (Database) ←→ Head Chef (Business Logic) ←→ Waiter (API) ←→ Customer
```

**The Head Chef** is your business logic layer. They:
- Check if ingredients are fresh (validation)
- Follow recipes exactly (business rules)
- Won't serve food that violates health codes (quota limits)
- Ensure dishes meet quality standards (difficulty progression)

Without the Head Chef, waiters would serve anything - bad ingredients, uncooked food, expired items.

## Core Concept 1: Custom Exceptions (Speaking a Common Language)

### The Problem
```javascript
// Bad: Generic errors tell you nothing
throw new Error('Something went wrong');
throw new Error('Invalid data');
throw new Error('Not found');

// What HTTP status code? 400? 404? 500?
// What went wrong specifically?
// How does the client fix it?
```

### The Solution: Custom Exception Classes
```javascript
class QuizNotFoundError extends Error {
    constructor(quizId) {
        super(`Quiz with ID ${quizId} not found`);
        this.name = 'QuizNotFoundError';
        this.statusCode = 404;  // Always maps to 404
        this.quizId = quizId;    // Context for debugging
    }
}
```

### Why This Matters
1. **Consistency**: Every "quiz not found" error looks the same
2. **Debugging**: You know exactly what failed (quiz ID included)
3. **HTTP Mapping**: Automatically becomes a 404 response
4. **Client Handling**: Client can check `error.name` to show specific UI

### Analogy: Restaurant Order Problems
```
Generic: "Order problem"  →  Who knows what happened?

Specific:
- OutOfStockError("salmon")  →  Show "Salmon unavailable, try chicken"
- TableFullError(tableNum)   →  Show "Please wait 15 minutes"
- KitchenClosedError(time)   →  Show "Kitchen closes at 10 PM"
```

### Practice Exercise
**Create a custom exception for your own use case:**

```javascript
class EmailAlreadyExistsError extends Error {
    constructor(email) {
        super(`Email ${email} is already registered`);
        this.name = 'EmailAlreadyExistsError';
        this.statusCode = 409; // Conflict
        this.email = email;
    }
    
    toJSON() {
        return {
            error: this.name,
            message: this.message,
            statusCode: this.statusCode,
            email: this.email
        };
    }
}
```

## Core Concept 2: Business Rules (The "Rules of the Game")

### The Problem
```javascript
// Bad: Business logic scattered everywhere
// In controller:
if (quizzes.length < 50) {
    await createQuiz();
}

// In another controller:
if (userQuizCount < 50) {
    await createQuiz();
}

// In a third place:
if (await countQuizzes() <= 49) {
    await createQuiz();
}

// Result: Inconsistent, hard to change, bugs everywhere
```

### The Solution: Centralized Business Rules
```javascript
class QuizService {
    MAX_QUIZZES_PER_USER = 50;  // ONE source of truth
    
    async validateUserQuota(userId) {
        const count = await this.repository.getCreatorQuizCount(userId);
        if (count >= this.MAX_QUIZZES_PER_USER) {
            throw new QuizCreationLimitError(count, this.MAX_QUIZZES_PER_USER);
        }
    }
    
    async createQuiz(data, userId) {
        await this.validateUserQuota(userId);  // Always enforced
        // ... rest of creation logic
    }
}
```

### Why This Matters
1. **One Place to Change**: Need to raise limit to 100? Change one number
2. **Always Enforced**: Can't forget to check - it's built into createQuiz
3. **Testable**: Test the rule without database or HTTP server
4. **Documented**: The code IS the documentation of the rule

### Real-World Analogy: Speed Limits
```
Bad Approach:
- Each driver decides their own safe speed
- Police officer A says 65 is fine
- Police officer B says 70 is fine
- Chaos, accidents, arguments

Good Approach (Our Way):
- Sign says "Speed Limit 65"
- ONE rule, everyone knows it
- All police enforce the SAME rule
- Easy to change (new sign, everyone follows new rule)
```

### Practice Exercise
**Add a new business rule:**

```javascript
// Rule: Quizzes must have a title between 5-255 characters
class QuizService {
    MIN_TITLE_LENGTH = 5;
    MAX_TITLE_LENGTH = 255;
    
    validateTitle(title) {
        if (!title || title.trim().length < this.MIN_TITLE_LENGTH) {
            throw new ValidationError(
                `Title must be at least ${this.MIN_TITLE_LENGTH} characters`
            );
        }
        if (title.length > this.MAX_TITLE_LENGTH) {
            throw new ValidationError(
                `Title must be less than ${this.MAX_TITLE_LENGTH} characters`
            );
        }
    }
    
    async createQuiz(data, userId) {
        this.validateTitle(data.title);  // Always checked
        // ... rest of logic
    }
}
```

## Core Concept 3: The Validation Hierarchy

### Think of it like Airport Security

```
Level 1: TSA Pre-Check (Model Validation)
├─ Is your ID valid? (required fields present)
├─ Is your boarding pass readable? (correct data types)
└─ Do you have prohibited items? (basic format checks)

Level 2: Security Screening (Business Logic Validation)
├─ Is this a duplicate ticket? (quota check)
├─ Are you on the no-fly list? (authorization)
└─ Does your luggage meet weight limits? (business rules)

Both levels are necessary!
```

### In Code

**Level 1: Pydantic/Model Validation** (Quick checks)
```javascript
// Check: Does the data LOOK right?
if (!quizData.title) throw new Error('Title required');
if (!Array.isArray(quizData.questions)) throw new Error('Questions must be array');
```

**Level 2: Business Logic Validation** (Smart checks)
```javascript
// Check: Does the data MAKE SENSE according to our rules?
validateDifficultyProgression(questions);  // Educational quality
validateQuestionTypeDistribution(questions);  // Engagement/variety
await validateUserQuota(userId);  // Fair usage
```

### Why Both?
- **Fast Feedback**: Model validation catches 90% of problems instantly
- **Business Intelligence**: Business logic catches the nuanced 10%
- **Clear Errors**: Each layer provides specific, actionable error messages

## Core Concept 4: The Global Error Handler (One Place to Rule Them All)

### The Problem
```javascript
// Bad: Every route has custom error handling
app.post('/api/quizzes', async (req, res) => {
    try {
        // ...
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('quota')) {
            return res.status(429).json({ error: error.message });
        }
        if (error.message.includes('invalid')) {
            return res.status(400).json({ error: error.message });
        }
        // 50 more lines of if statements...
    }
});

// Copy-paste this to 20 routes = maintenance nightmare
```

### The Solution: Global Error Handler Middleware
```javascript
// In each route: Just throw the exception
app.post('/api/quizzes', async (req, res, next) => {
    try {
        const quiz = await quizService.createQuiz(req.body, req.user.id);
        res.json(quiz);
    } catch (error) {
        next(error);  // That's it! Pass to global handler
    }
});

// ONE place handles ALL errors
app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
        return res.status(400).json(err.toJSON());
    }
    if (err instanceof QuizNotFoundError) {
        return res.status(404).json(err.toJSON());
    }
    if (err instanceof QuizCreationLimitError) {
        return res.status(429).json(err.toJSON());
    }
    // ... one check per exception type
    
    // Fallback for unexpected errors
    res.status(500).json({ error: 'Internal Server Error' });
});
```

### Why This Is Powerful
1. **DRY (Don't Repeat Yourself)**: Write error handling once
2. **Consistent**: All errors formatted the same way
3. **Easy to Extend**: New exception? Add one if statement
4. **Centralized Logging**: Add logging in one place, catches all errors

### Analogy: Customer Service Department
```
Bad Way: Every employee handles complaints differently
- Bob says "No refunds"
- Sarah says "Here's a 50% refund"  
- Mike says "Have a free product"
- Customers confused, company loses money

Good Way (Our Global Handler):
- All complaints go to Customer Service department
- ONE policy for refunds
- ONE policy for exchanges
- Consistent experience, happy customers
```

## Core Concept 5: Patterns You'll Use Forever

### Pattern 1: Separation of Concerns
```
Controller (Express Routes)
├─ Handle HTTP stuff (req, res, status codes)
├─ Parse request body
└─ Call service with clean data

Service (Business Logic)
├─ Validate business rules
├─ Enforce constraints
├─ Coordinate operations
└─ Return domain objects

Repository (Data Access)
├─ Talk to database
├─ Run queries
├─ Handle caching
└─ Return raw data
```

**Rule of Thumb**: If you can describe what a layer does in one sentence, you're doing it right.

### Pattern 2: Fail Fast, Fail Clearly
```javascript
async createQuiz(data, userId) {
    // Check cheapest things first (no database hit)
    this.validateTitle(data.title);
    this.validateQuestions(data.questions);
    
    // Then check expensive things (database query)
    await this.validateUserQuota(userId);
    
    // Finally, do the actual work
    return await this.repository.createQuiz(data);
}
```

**Why This Order?**
- Fast failures save resources
- Clear error messages tell user exactly what's wrong
- User can fix issues before server does expensive work

### Pattern 3: Constants for Magic Numbers
```javascript
// Bad: Magic numbers scattered everywhere
if (quizzes.length >= 50) { ... }
if (count > 50) { ... }
if (userQuizzes.length === 51) { ... }  // Bug! Should be 50

// Good: Named constant clarifies intent
class QuizService {
    MAX_QUIZZES_PER_USER = 50;
    
    if (count >= this.MAX_QUIZZES_PER_USER) { ... }
}
```

**Benefits:**
- Change once, effect everywhere
- Self-documenting code
- No magic numbers to debug

## Practical Application: Build Your Own

### Exercise: Implement a Comment System

Apply everything you learned:

```javascript
// 1. Custom Exceptions
class CommentTooLongError extends Error {
    constructor(length, maxLength) {
        super(`Comment is ${length} characters, max is ${maxLength}`);
        this.name = 'CommentTooLongError';
        this.statusCode = 400;
        this.currentLength = length;
        this.maxLength = maxLength;
    }
    
    toJSON() {
        return {
            error: this.name,
            message: this.message,
            statusCode: this.statusCode,
            currentLength: this.currentLength,
            maxLength: this.maxLength
        };
    }
}

class TooManyCommentsError extends Error {
    constructor(count, limit) {
        super(`You have ${count} comments today, limit is ${limit}`);
        this.name = 'TooManyCommentsError';
        this.statusCode = 429;
    }
}

// 2. Business Logic Service
class CommentService {
    MAX_COMMENT_LENGTH = 1000;
    MAX_COMMENTS_PER_DAY = 50;
    MIN_COMMENT_LENGTH = 3;
    
    validateCommentLength(text) {
        if (text.length < this.MIN_COMMENT_LENGTH) {
            throw new ValidationError('Comment too short');
        }
        if (text.length > this.MAX_COMMENT_LENGTH) {
            throw new CommentTooLongError(text.length, this.MAX_COMMENT_LENGTH);
        }
    }
    
    async validateDailyLimit(userId) {
        const todayCount = await this.repository.getCommentsToday(userId);
        if (todayCount >= this.MAX_COMMENTS_PER_DAY) {
            throw new TooManyCommentsError(todayCount, this.MAX_COMMENTS_PER_DAY);
        }
    }
    
    async createComment(text, userId) {
        // Cheap validation first
        this.validateCommentLength(text);
        
        // Expensive validation second
        await this.validateDailyLimit(userId);
        
        // Create the comment
        return await this.repository.createComment(text, userId);
    }
}

// 3. Controller with Global Error Handling
app.post('/api/comments', async (req, res, next) => {
    try {
        const comment = await commentService.createComment(
            req.body.text,
            req.user.id
        );
        res.status(201).json(comment);
    } catch (error) {
        next(error);  // Let global handler deal with it
    }
});

// 4. Global Error Handler
app.use((err, req, res, next) => {
    if (err instanceof CommentTooLongError) {
        return res.status(400).json(err.toJSON());
    }
    if (err instanceof TooManyCommentsError) {
        return res.status(429).json(err.toJSON());
    }
    // ... other exceptions
    
    res.status(500).json({ error: 'Internal Server Error' });
});
```

## Mental Models That Stick

### 1. The Exception Hierarchy is Your Error Dictionary
Just like a real dictionary has entries for specific words, your exception hierarchy has entries for specific errors. When you need to report an error, look up the right "word" (exception class).

### 2. Business Logic is Your Rulebook
Like a referee's rulebook in sports. The rules don't change mid-game, they apply to everyone equally, and there's one official rulebook (not different copies).

### 3. Global Error Handler is Your Safety Net
Like circus performers with a safety net below. No matter where you fall (throw an error), the net (global handler) catches you the same way.

### 4. Separation of Concerns is Like Building Construction
- Foundation (Repository): Stable, doesn't change often
- Walls/Structure (Service): Where the interesting stuff happens
- Paint/Decoration (Controller): What users interact with

You don't repaint the whole house when you change a doorknob.

## Debugging Guide: When Things Go Wrong

### Problem: "My exception isn't being caught"
```javascript
// Check 1: Did you throw it correctly?
throw new ValidationError('Bad data');  // ✓ Correct

// Check 2: Did you use next(error)?
catch (error) {
    next(error);  // ✓ Correct - goes to global handler
}

catch (error) {
    res.status(500).json({ error: error.message });  // ✗ Wrong - bypasses global handler
}

// Check 3: Is global handler defined AFTER routes?
app.get('/api/quizzes', ...);  // Routes first
app.use((err, req, res, next) => { ... });  // Error handler LAST
```

### Problem: "Getting 500 errors instead of 400/404"
```javascript
// Your exception might not be extending Error correctly
class MyError extends Error {  // Must extend Error
    constructor(message) {
        super(message);  // Must call super()
        this.name = 'MyError';  // Must set name
    }
}

// Check: Is your global handler checking for it?
if (err instanceof MyError) {  // Must check in handler
    return res.status(400).json(err.toJSON());
}
```

### Problem: "Business rules not being enforced"
```javascript
// Check: Are you calling validation before creation?
async createQuiz(data, userId) {
    await this.validateUserQuota(userId);  // Must be BEFORE create
    return await this.repository.createQuiz(data);
}

// Check: Can someone bypass your service layer?
app.post('/api/quizzes', async (req, res) => {
    // Bad: Calling repository directly
    await repository.createQuiz(req.body);  // ✗ Skips validation
    
    // Good: Calling service
    await quizService.createQuiz(req.body, req.user.id);  // ✓ Enforces rules
});
```

## Key Takeaways (The Sticky Parts)

1. **Custom Exceptions = Speaking Clearly**
   - Each error type is a specific conversation
   - Includes context (quiz ID, count, etc.)
   - Maps to HTTP status automatically

2. **Business Logic = The Rules of Your Game**
   - One place to define rules
   - One place to change rules
   - Easy to test, hard to break

3. **Global Error Handler = Your Safety Net**
   - One place catches all errors
   - Consistent error responses
   - Easy to add logging/monitoring

4. **Separation of Concerns = Organized Kitchen**
   - Controller = Waiter (handles customers)
   - Service = Chef (follows recipes/rules)
   - Repository = Storage (gets ingredients)

5. **Fail Fast, Fail Clear**
   - Check cheap things first
   - Tell user exactly what's wrong
   - Give them info to fix it

## Next Steps

1. **Practice**: Implement a similar pattern for another feature (comments, posts, orders)
2. **Read**: Look at how popular libraries do this (NestJS, Django, Ruby on Rails)
3. **Refactor**: Find code in your project that could use these patterns
4. **Teach**: Explain these concepts to someone else (best way to solidify learning)

Remember: These patterns work in ANY language (Python, Java, Go, C#). The concepts are universal. The syntax changes, but the thinking stays the same.

---

**The Real Secret**: Good architecture isn't about being clever, it's about being boring and predictable. When every error, every validation, every business rule works the same way, your brain can relax and focus on solving real problems instead of remembering where you put that one special error handling case.

Keep it simple. Keep it consistent. Keep it boring. Your future self will thank you.
