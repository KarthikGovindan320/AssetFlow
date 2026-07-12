import { Request, Response } from 'express';
import { parseBody, parseParams, parseQuery, idParamSchema } from '../../lib/validation';
import * as service from './department.service';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.schemas';

export async function list(req: Request, res: Response) {
  const query = parseQuery(listDepartmentsQuerySchema, req);
  res.json(await service.listDepartments(query));
}

export async function options(_req: Request, res: Response) {
  res.json({ data: await service.departmentOptions() });
}

export async function tree(_req: Request, res: Response) {
  res.json({ data: await service.departmentTree() });
}

export async function get(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.getDepartment(id));
}

export async function create(req: Request, res: Response) {
  const input = parseBody(createDepartmentSchema, req);
  res.status(201).json(await service.createDepartment(req.user!.id, input));
}

export async function update(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const input = parseBody(updateDepartmentSchema, req);
  res.json(await service.updateDepartment(req.user!.id, id, input));
}

export async function deactivate(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.setDepartmentStatus(req.user!.id, id, 'INACTIVE'));
}

export async function activate(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.setDepartmentStatus(req.user!.id, id, 'ACTIVE'));
}
