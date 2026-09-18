import { readFile } from 'node:fs/promises';

import { getAI } from '../ai/index.js';
import { ApiError } from '../middleware/errors.js';
import { absoluteUploadPath } from '../middleware/upload.js';
import { extractDocument } from '../ingest/office.js';
import { extractPdf } from '../ingest/pdf.js';
import { trackGeneration } from './aiUsage.service.js';
import { teacherDb } from '../db/teacher.db.js';
import { balanceAnswerPositions } from './quiz.service.js';

const contextFor = (rows) => rows
  .filter((row) => row.content_md || row.item_content)
  .map((row) => [row.lesson_title, row.content_md, row.item_title, row.item_content].filter(Boolean).join('\n'))
  .join('\n\n');

const requireContext = async (teacherId, classId) => {
  const rows = await teacherDb.classContext({ teacherId, classId });
  if (rows.length === 0) throw ApiError.notFound('That class does not exist or is not yours');
  return {
    title: rows[0].class_title,
    subject: rows[0].subject,
    text: contextFor(rows) || `Class: ${rows[0].class_title}\nSubject: ${rows[0].subject ?? 'General'}`,
  };
};

const materialText = async (material, language) => {
  const path = absoluteUploadPath(material.storage_path);
  if (material.mime_type === 'application/pdf') {
    const extracted = await extractPdf(path);
    return extracted.fullText;
  }
  if (material.mime_type?.startsWith('image/')) {
    const ai = getAI();
    const result = await ai.extractImageText({
      images: [{ data: await readFile(path), mimeType: material.mime_type }],
      language,
    });
    return result.hasText ? result.text : '';
  }
  const extracted = await extractDocument(path, { mimeType: material.mime_type });
  return extracted.fullText;
};

export const teacherAssistantService = {
  async ask(teacherId, input) {
    const context = input.classId ? await requireContext(teacherId, input.classId) : null;
    const conversation = await teacherDb.assistantConversation({
      teacherId, conversationId: input.conversationId, classId: input.classId, language: input.language,
    });
    if (!conversation) throw ApiError.notFound('That assistant conversation does not exist');
    const history = await teacherDb.assistantMessages({ teacherId, conversationId: conversation.id });
    await teacherDb.addAssistantMessage({ teacherId, conversationId: conversation.id, role: 'user', content: input.content });
    const ai = getAI();
    const messages = [{
      role: 'user',
      content: context
        ? `You are a teaching copilot for a teacher. Give practical, accurate help with lesson planning, assignment design, grading, and student support. Use the selected class context only when it answers the question. If it does not, say what information is missing.\n\nClass context:\n${context.text}\n\nTeacher question:\n${input.content}`
        : `You are a teaching copilot for a teacher. Give practical, accurate help with lesson planning, assignment design, grading, and student support. If you do not have enough information, say what is missing.\n\nTeacher question:\n${input.content}`,
    }];
    messages.unshift(...history.map((item) => ({ role: item.role, content: item.content })));
    const result = await trackGeneration({
      kind: 'tutor', userId: teacherId, language: input.language,
      sourceText: context?.text ?? '', request: { teacherAssistant: true, classId: input.classId ?? null },
      describe: (value) => ({ answerChars: value.content.length }),
    }, async ({ onUsage }) => {
      let content = '';
      let citations = [];
      for await (const chunk of ai.tutorReply({
        messages,
        language: input.language,
        sources: context ? [{ title: context.title, content: context.text }] : [],
        maxOutputTokens: 500,
        onUsage,
      })) {
        if (chunk.type === 'delta') content += chunk.text;
        if (chunk.type === 'done') citations = chunk.citations ?? [];
        if (chunk.type === 'error') throw ApiError.badRequest(chunk.message);
      }
      return { content, citations };
    });
    await teacherDb.addAssistantMessage({ teacherId, conversationId: conversation.id, role: 'assistant', content: result.content });
    return { ...result, classId: input.classId ?? null, conversationId: conversation.id };
  },

  async history(teacherId) {
    const rows = await teacherDb.assistantHistory(teacherId);
    return { conversations: rows.map((row) => ({
      id: row.id, classId: row.class_id, classTitle: row.class_title,
      language: row.language, title: row.title, lastContent: row.last_content,
      lastMessageAt: row.last_message_at,
    })) };
  },

  async clearHistory(teacherId) {
    await teacherDb.clearAssistantHistory(teacherId);
    return { cleared: true };
  },

  async generateQuiz(teacherId, input) {
    const context = await requireContext(teacherId, input.classId);
    const selectedMaterials = await teacherDb.selectedMaterials({
      teacherId, classId: input.classId, materialIds: input.sourceMaterialIds,
    });
    if (selectedMaterials.length !== input.sourceMaterialIds.length) {
      throw ApiError.badRequest('One or more source materials do not belong to this class');
    }
    const extractedMaterials = await Promise.all(selectedMaterials.map(async (material) => ({
      title: material.title,
      text: await materialText(material, input.language),
    })));
    const sourceText = selectedMaterials.length
      ? extractedMaterials
        .filter((material) => material.text.trim())
        .map((material) => `Source: ${material.title}\n${material.text}`)
        .join('\n\n')
      : context.text;
    if (!sourceText.trim()) throw ApiError.badRequest('The selected materials contain no readable text');
    const ai = getAI();
    if (ai.name === 'mock') {
      throw ApiError.serviceUnavailable(
        'AI quiz generation needs an OPENAI_API_KEY. The demo provider cannot create questions from uploaded course files.',
      );
    }
    const quiz = await trackGeneration({
      kind: 'quiz', userId: teacherId, language: input.language,
      sourceText, request: { teacherAssistant: true, classId: input.classId, count: input.count, sourceMaterialIds: input.sourceMaterialIds },
      describe: (value) => ({ questionCount: value.questions?.length ?? 0 }),
    }, ({ onUsage }) => ai.generateQuiz({
      text: sourceText, title: input.title ?? context.title, language: input.language,
      count: input.count, difficulty: input.difficulty, questionTypes: input.questionTypes,
      includeAnswerKey: input.includeAnswerKey, onUsage,
    }));
    return {
      draft: {
        ...quiz,
        questions: balanceAnswerPositions(quiz.questions),
        classId: input.classId,
      },
    };
  },
};