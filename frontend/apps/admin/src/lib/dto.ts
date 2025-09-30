import { z } from 'zod';

export const mcqQuestionSchema = z.object({
    _id: z.string().optional(),
    type: z.literal('mcq'),
    prompt: z.string().min(5),
    tags: z.array(z.string()).optional().default([]),
    options: z.array(z.string()).min(2),
    role: z.string().optional(),
    language: z.string().optional(),
});

export const codingQuestionSchema = z.object({
    _id: z.string().optional(),
    type: z.literal('coding'),
    prompt: z.string().min(5),
    tags: z.array(z.string()).optional().default([]),
    starter_code: z.string().min(0).optional(),
    programmingLanguage: z.string().optional(),
    testCases: z.array(z.object({ input: z.string(), expectedOutput: z.string() })).optional()
});

export const descriptiveQuestionSchema = z.object({
    _id: z.string().optional(),
    type: z.literal('descriptive'),
    prompt: z.string().min(5),
    tags: z.array(z.string()).optional().default([]),
    role: z.string().optional(),
});

export const questionSchema = z.discriminatedUnion('type', [
    mcqQuestionSchema,
    codingQuestionSchema,
    descriptiveQuestionSchema
]);

export const questionsResponseSchema = z.object({
    success: z.boolean().optional(),
    questions: z.array(questionSchema),
    nextCursor: z.string().nullable().optional(),
    total: z.number().optional()
});

export type QuestionDTO = z.infer<typeof questionSchema>;
