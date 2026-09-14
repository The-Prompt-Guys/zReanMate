import { assignmentsService } from '../services/assignments.service.js';

export const assignmentsController = {
  async create(req, res) { res.status(201).json(await assignmentsService.create(req.auth.userId, req.validatedParams.lessonId, req.body)); },
  async show(req, res) { res.json(await assignmentsService.get(req.auth.userId, req.validatedParams.assignmentId)); },
  async questions(req, res) { res.json(await assignmentsService.questions(req.auth.userId, req.validatedParams.assignmentId)); },
  async save(req, res) { res.json(await assignmentsService.saveQuiz(req.auth.userId, req.validatedParams.assignmentId, req.body)); },
  async upload(req, res) { res.status(201).json(await assignmentsService.upload(req.auth.userId, req.validatedParams.assignmentId, req.file)); },
  async submissions(req, res) { res.json(await assignmentsService.submissions(req.auth.userId, req.validatedParams.assignmentId)); },
  async grade(req, res) { res.json(await assignmentsService.grade(req.auth.userId, req.validatedParams.assignmentId, req.validatedParams.submissionId, req.body)); },
};

