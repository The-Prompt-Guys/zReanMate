import { teacherService } from '../services/teacher.service.js';
import { teacherAssistantService } from '../services/teacherAssistant.service.js';

export const teacherController = {
  async dashboard(req, res) {
    res.json(await teacherService.dashboard(req.auth.userId));
  },

  async updateClass(req, res) {
    res.json(await teacherService.updateClass(req.auth.userId, req.params.classId, req.body));
  },

  async students(req, res) {
    res.json(await teacherService.students(req.auth.userId, req.params.classId));
  },

  async assignments(req, res) {
    res.json(await teacherService.assignments(req.auth.userId));
  },

  async assignment(req, res) {
    res.json(await teacherService.assignment(req.auth.userId, req.validatedParams.assignmentId));
  },

  async updateAssignment(req, res) {
    res.json(await teacherService.updateAssignment(
      req.auth.userId,
      req.validatedParams.assignmentId,
      req.body,
    ));
  },

  async deleteAssignment(req, res) {
    res.json(await teacherService.deleteAssignment(
      req.auth.userId,
      req.validatedParams.assignmentId,
    ));
  },

  async createAssignment(req, res) {
    res.status(201).json(await teacherService.createAssignment(req.auth.userId, req.body));
  },

  async createQuiz(req, res) {
    res.status(201).json(await teacherService.createQuiz(req.auth.userId, req.body));
  },

  async addAssignmentAttachment(req, res) {
    res.status(201).json(await teacherService.addAssignmentAttachment(
      req.auth.userId,
      req.validatedParams.assignmentId,
      req.file,
    ));
  },

  async materials(req, res) {
    res.json(await teacherService.materials(req.auth.userId, req.validatedParams.classId));
  },

  async materialFile(req, res) {
    const file = await teacherService.materialFile(
      req.auth.userId,
      req.validatedParams.classId,
      req.validatedParams.materialId,
    );
    res.type(file.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(file.path);
  },

  async addMaterial(req, res) {
    res.status(201).json(await teacherService.addMaterial(
      req.auth.userId,
      req.validatedParams.classId,
      req.file,
      req.body.title,
      req.body.weekNumber,
    ));
  },

  async removeMaterial(req, res) {
    res.json(await teacherService.removeMaterial(req.auth.userId, req.validatedParams.classId, req.validatedParams.materialId));
  },

  async assistantAsk(req, res) {
    res.json(await teacherAssistantService.ask(req.auth.userId, req.body));
  },

  async assistantHistory(req, res) {
    res.json(await teacherAssistantService.history(req.auth.userId));
  },

  async clearAssistantHistory(req, res) {
    res.json(await teacherAssistantService.clearHistory(req.auth.userId));
  },

  async assistantQuiz(req, res) {
    res.json(await teacherAssistantService.generateQuiz(req.auth.userId, req.body));
  },
};